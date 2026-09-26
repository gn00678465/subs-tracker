import type { PeriodUnit, ReminderSetting, Subscription } from '../types'
import type { CalendarDate } from '../utils/calendarDate'

interface SubscriptionRow {
  id: string
  name: string
  category: string
  currency: string
  price: number
  period_value: number
  period_unit: PeriodUnit
  start_date: CalendarDate | null
  expiry_date: CalendarDate
  cancel_by_date: CalendarDate | null
  auto_renew: number
  is_free_trial: number
  is_active: number
  reminder_kind: 'default' | 'off' | 'days'
  reminder_days: number | null
  payment_method: string
  website: string
  notes: string
  last_reminder_sent_at: string | null
  last_checked_expiry_date: CalendarDate | null
  created_at: string
  updated_at: string
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    currency: row.currency,
    price: row.price,
    periodValue: row.period_value,
    periodUnit: row.period_unit,
    startDate: row.start_date ?? undefined,
    expiryDate: row.expiry_date,
    cancelByDate: row.cancel_by_date ?? undefined,
    autoRenew: row.auto_renew === 1,
    isFreeTrial: row.is_free_trial === 1,
    isActive: row.is_active === 1,
    reminder: row.reminder_kind === 'days' ? (row.reminder_days as number) : row.reminder_kind,
    paymentMethod: row.payment_method,
    website: row.website,
    notes: row.notes,
    lastReminderSentAt: row.last_reminder_sent_at ?? undefined,
    lastCheckedExpiryDate: row.last_checked_expiry_date ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function reminderColumns(reminder: ReminderSetting): [SubscriptionRow['reminder_kind'], number | null] {
  return typeof reminder === 'number' ? ['days', reminder] : [reminder, null]
}

// 使用者擁有的欄位；last_reminder_sent_at 與 last_checked_expiry_date 只由 Cron 寫入
function userColumns(s: Subscription): Record<string, string | number | null> {
  const [reminderKind, reminderDays] = reminderColumns(s.reminder)
  return {
    name: s.name,
    category: s.category,
    currency: s.currency,
    price: s.price,
    period_value: s.periodValue,
    period_unit: s.periodUnit,
    start_date: s.startDate ?? null,
    expiry_date: s.expiryDate,
    cancel_by_date: s.cancelByDate ?? null,
    auto_renew: s.autoRenew ? 1 : 0,
    is_free_trial: s.isFreeTrial ? 1 : 0,
    is_active: s.isActive ? 1 : 0,
    reminder_kind: reminderKind,
    reminder_days: reminderDays,
    payment_method: s.paymentMethod,
    website: s.website,
    notes: s.notes,
    updated_at: s.updatedAt,
  }
}

export async function listSubscriptions(db: D1Database): Promise<Subscription[]> {
  const { results } = await db
    .prepare('SELECT * FROM subscriptions ORDER BY expiry_date, created_at')
    .all<SubscriptionRow>()
  return results.map(toSubscription)
}

export async function findSubscription(db: D1Database, id: string): Promise<Subscription | null> {
  const row = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first<SubscriptionRow>()
  return row ? toSubscription(row) : null
}

/** `ignoreExisting` 讓重複匯入同一筆時略過，不覆蓋 */
export function insertSubscription(
  db: D1Database,
  s: Subscription,
  { ignoreExisting = false } = {},
): D1PreparedStatement {
  const columns = {
    id: s.id,
    ...userColumns(s),
    last_reminder_sent_at: s.lastReminderSentAt ?? null,
    last_checked_expiry_date: s.lastCheckedExpiryDate ?? null,
    created_at: s.createdAt,
  }
  const names = Object.keys(columns)
  return db
    .prepare(
      `INSERT ${ignoreExisting ? 'OR IGNORE ' : ''}INTO subscriptions (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
    )
    .bind(...Object.values(columns))
}

/** 寫入使用者擁有的欄位；訂閱不存在時回傳 null */
export async function saveUserFields(db: D1Database, s: Subscription): Promise<Subscription | null> {
  const columns = userColumns(s)
  const row = await db
    .prepare(
      `UPDATE subscriptions SET ${Object.keys(columns)
        .map((name) => `${name} = ?`)
        .join(', ')} WHERE id = ? RETURNING *`,
    )
    .bind(...Object.values(columns), s.id)
    .first<SubscriptionRow>()
  return row ? toSubscription(row) : null
}

export async function deleteSubscriptionRow(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM subscriptions WHERE id = ?').bind(id).run()
  return result.meta.changes > 0
}
