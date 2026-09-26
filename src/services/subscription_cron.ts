import type { ChannelId, Settings } from '../db/settings'
import { CHANNELS, readChannels, recordChannelResult } from '../db/settings'
import { listSubscriptions } from '../db/subscriptions'
import type { Bindings, Subscription } from '../types'
import type { CalendarDate } from '../utils/calendarDate'
import { daysBetween, hourIn, todayIn } from '../utils/calendarDate'
import * as logger from '../utils/logger'
import { sendNotificationToAllChannels } from './notifier'
import { loadSettings } from './settings'
import { rollForward } from './subscription'

export type ReminderKind = 'renewal' | 'trial' | 'cancelBy'

export interface ReminderNotice {
  kind: ReminderKind
  date: CalendarDate
  daysLeft: number
}

export type ReminderPolicy = Pick<Settings, 'timezone' | 'reminderMode' | 'defaultReminderDays'>

function reminderDays(subscription: Subscription, policy: ReminderPolicy): number | null {
  if (subscription.reminder === 'off') return null
  return subscription.reminder === 'default' ? policy.defaultReminderDays : subscription.reminder
}

// ONCE：同一個扣款日只提醒一次；使用者改了扣款日就重新提醒。DAILY：每天一次
function alreadyReminded(subscription: Subscription, today: CalendarDate, policy: ReminderPolicy): boolean {
  if (!subscription.lastReminderSentAt) return false
  if (subscription.lastCheckedExpiryDate !== subscription.expiryDate) return false
  if (policy.reminderMode === 'DAILY') {
    return todayIn(policy.timezone, new Date(subscription.lastReminderSentAt)) === today
  }
  return true
}

/** 有取消期限時依取消期限提醒；試用中提醒試用結束；其餘提醒扣款 */
export function planReminder(
  subscription: Subscription,
  today: CalendarDate,
  policy: ReminderPolicy,
): ReminderNotice | null {
  const days = reminderDays(subscription, policy)
  if (!subscription.isActive || days === null) return null

  const [kind, date]: [ReminderKind, CalendarDate] = subscription.cancelByDate
    ? ['cancelBy', subscription.cancelByDate]
    : [subscription.isFreeTrial ? 'trial' : 'renewal', subscription.expiryDate]
  const daysLeft = daysBetween(today, date)
  if (daysLeft < 0 || daysLeft > days) return null
  if (alreadyReminded(subscription, today, policy)) return null
  return { kind, date, daysLeft }
}

export function reminderMessage(
  subscription: Subscription,
  notice: ReminderNotice,
): { title: string; content: string } {
  const when = notice.daysLeft === 0 ? '今天' : `${notice.daysLeft} 天後`
  const { name } = subscription
  const price = `${subscription.currency} ${subscription.price}`
  switch (notice.kind) {
    case 'trial':
      return {
        title: `試用即將結束：${name}`,
        content: `「${name}」的試用${when}結束（${notice.date}）。之後每期扣款 ${price}。不想付費，請在結束前取消。`,
      }
    case 'cancelBy':
      return {
        title: `取消期限：${name}`,
        content: `「${name}」的取消期限是${when}（${notice.date}）。在期限內取消，才不會扣款 ${price}。`,
      }
    case 'renewal':
      return {
        title: `續訂提醒：${name}`,
        content: `「${name}」${when}扣款 ${price}（${notice.date}）。`,
      }
  }
}

function isChannelId(value: string): value is ChannelId {
  return (CHANNELS as readonly string[]).includes(value)
}

// Cron 只在使用者沒有改過這筆訂閱時寫入；改過的話，下一次執行會以新資料重新計算
function saveRollForward(db: D1Database, before: Subscription, after: Subscription): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE subscriptions SET expiry_date = ?, is_free_trial = ?, cancel_by_date = NULL
       WHERE id = ? AND expiry_date = ? AND updated_at = ?`,
    )
    .bind(after.expiryDate, after.isFreeTrial ? 1 : 0, before.id, before.expiryDate, before.updatedAt)
}

function saveReminderSent(db: D1Database, subscription: Subscription, at: string): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE subscriptions SET last_reminder_sent_at = ?, last_checked_expiry_date = expiry_date
       WHERE id = ? AND expiry_date = ?`,
    )
    .bind(at, subscription.id, subscription.expiryDate)
}

function saveDelivery(
  db: D1Database,
  subscriptionId: string,
  localDate: CalendarDate,
  channel: string,
  error: string | null,
  at: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR REPLACE INTO reminder_deliveries (subscription_id, local_date, channel, status, error, attempted_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(subscriptionId, localDate, channel, error === null ? 'sent' : 'failed', error, at)
}

/**
 * Cron 每小時執行；只在使用者時區的提醒小時處理。
 * 先送通知，再把結果寫入 D1。寫入失敗時記錄錯誤，通知已經送出。
 */
export async function runReminders(env: Bindings, now: Date): Promise<void> {
  const settings = await loadSettings(env, now)
  if (hourIn(settings.timezone, now) !== settings.reminderHour) return

  const db = env.DB
  const channels = await readChannels(db)
  const today = todayIn(settings.timezone, now)
  const startedAt = now.toISOString()
  const run = await db
    .prepare('INSERT INTO cron_runs (local_date, started_at) VALUES (?, ?) RETURNING id')
    .bind(today, startedAt)
    .first<{ id: number }>()

  let reminded = 0
  let failed = 0
  try {
    const statements: D1PreparedStatement[] = []
    const channelResults = new Map<ChannelId, string | null>()

    for (const original of await listSubscriptions(db)) {
      const subscription = original.isActive ? rollForward(original, today) : original
      if (subscription !== original) statements.push(saveRollForward(db, original, subscription))

      const notice = planReminder(subscription, today, settings)
      if (!notice) continue

      const result = await sendNotificationToAllChannels(reminderMessage(subscription, notice), channels)
      for (const { channel, success, error } of result.results) {
        const message = success ? null : (error ?? '發送失敗')
        statements.push(saveDelivery(db, subscription.id, today, channel, message, startedAt))
        // 同一次執行中，某個管道只要失敗過一次就記為失敗
        if (isChannelId(channel) && channelResults.get(channel) == null) channelResults.set(channel, message)
      }
      if (result.successCount > 0) {
        reminded++
        statements.push(saveReminderSent(db, subscription, startedAt))
      } else {
        failed++
      }
    }

    for (const [channel, error] of channelResults) {
      statements.push(recordChannelResult(db, channel, error === null ? 'ok' : 'failed', error, startedAt))
    }
    if (statements.length > 0) await db.batch(statements)
    await finishRun(db, run?.id, reminded, failed, null)
  } catch (error) {
    logger.error('提醒排程失敗', error, { prefix: 'Cron' })
    await finishRun(db, run?.id, reminded, failed, error instanceof Error ? error.message : String(error))
    throw error
  }
}

async function finishRun(
  db: D1Database,
  id: number | undefined,
  reminded: number,
  failed: number,
  error: string | null,
): Promise<void> {
  if (id === undefined) return
  await db
    .prepare('UPDATE cron_runs SET finished_at = ?, reminded = ?, failed = ?, error = ? WHERE id = ?')
    .bind(new Date().toISOString(), reminded, failed, error, id)
    .run()
}
