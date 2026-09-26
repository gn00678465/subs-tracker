import type { ChannelState, Settings } from '../db/settings'
import { CHANNEL_FIELDS, CHANNELS, insertSettingsIfAbsent, upsertChannel } from '../db/settings'
import { insertSubscription } from '../db/subscriptions'
import type { Bindings, PeriodUnit, ReminderSetting, Subscription } from '../types'
import type { StoredCredential } from '../types/webauthn'
import type { CalendarDate } from '../utils/calendarDate'
import { hourIn, isCalendarDate } from '../utils/calendarDate'
import { generateRandomSecret, hashPassword } from '../utils/crypto'
import * as logger from '../utils/logger'

/**
 * 舊版把所有資料存在 KV。settings 沒有資料時，把 KV 的資料在一個 batch() 內匯入 D1。
 * batch() 是交易，任何一筆失敗整批回復；所有 INSERT 都略過已存在的列，所以並行或重複匯入不會覆蓋資料。
 * KV 不修改、不刪除。
 */
export async function importLegacyData(env: Bindings, now: Date): Promise<void> {
  const kv = env.SUBSCRIPTIONS_KV
  const stored = parseJson<LegacyConfig>(await kv.get('config'), 'config') ?? {}
  const settings = await legacySettings(stored)
  const at = now.toISOString()

  const subscriptions = (parseJson<LegacySubscription[]>(await kv.get('subscriptions'), 'subscriptions') ?? []).map(
    normalizeLegacySubscription,
  )
  const credentials = await legacyCredentials(kv, settings.adminUsername)
  const rpId = stored.WEBAUTHN_RP_ID || null

  await env.DB.batch([
    ...subscriptions.map((s) => insertSubscription(env.DB, s, { ignoreExisting: true })),
    ...credentials.map((credential) => insertLegacyCredential(env.DB, credential, rpId)),
    ...legacyChannels(stored).map((channel) =>
      upsertChannel(env.DB, channel.channel, channel.enabled, channel.config, at, { ignoreExisting: true }),
    ),
    // 最後寫 settings：settings 有資料代表匯入已完成
    insertSettingsIfAbsent(env.DB, settings, at),
  ])

  logger.info(`從 KV 匯入 ${subscriptions.length} 筆訂閱、${credentials.length} 個 passkey`, { prefix: 'Import' })
}

// ==================== 設定 ====================

type LegacyConfig = Partial<Record<string, unknown>> & {
  ADMIN_USERNAME?: string
  ADMIN_PASSWORD?: string
  JWT_SECRET?: string
  TIMEZONE?: string
  REMINDER_HOUR?: unknown
  REMINDER_MODE?: unknown
  DEFAULT_REMINDER_DAYS?: unknown
  ENABLED_NOTIFIERS?: unknown
  WEBAUTHN_RP_ID?: string
}

export const DEFAULT_REMINDER_HOUR = 9

async function legacySettings(stored: LegacyConfig): Promise<Settings> {
  const jwtSecret =
    stored.JWT_SECRET && stored.JWT_SECRET !== 'your-secret-key' ? stored.JWT_SECRET : generateRandomSecret()
  const password = stored.ADMIN_PASSWORD || 'password'
  const timezone = stored.TIMEZONE || 'UTC'
  const isLegacyInstall = Object.keys(stored).length > 0

  return {
    adminUsername: stored.ADMIN_USERNAME || 'admin',
    adminPasswordHash: isPasswordHash(password) ? password : await hashPassword(password, jwtSecret),
    jwtSecret,
    timezone,
    reminderHour: isIntegerBetween(stored.REMINDER_HOUR, 0, 23)
      ? stored.REMINDER_HOUR
      : isLegacyInstall
        ? legacyReminderHour(timezone)
        : DEFAULT_REMINDER_HOUR,
    reminderMode: stored.REMINDER_MODE === 'DAILY' ? 'DAILY' : 'ONCE',
    defaultReminderDays: isIntegerBetween(stored.DEFAULT_REMINDER_DAYS, 1, 365) ? stored.DEFAULT_REMINDER_DAYS : 3,
    webauthnUserHandle: null,
  }
}

// HMAC-SHA256 的 hex 輸出是 64 個字元；其他值都是舊版的明文密碼
function isPasswordHash(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value)
}

// 舊版沒有 REMINDER_HOUR，Cron 固定在 UTC 00:00 發送；換算成使用者時區的小時以維持原本的發送時間
function legacyReminderHour(timezone: string): number {
  const utcMidnight = new Date()
  utcMidnight.setUTCHours(0, 0, 0, 0)
  return hourIn(timezone, utcMidnight)
}

const LEGACY_CHANNEL_ALIASES: Record<string, string> = {
  TELEGRAM_BOT_TOKEN: 'TG_BOT_TOKEN',
  TELEGRAM_CHAT_ID: 'TG_CHAT_ID',
  BARK_KEY: 'BARK_DEVICE_KEY',
  BARK_SAVE: 'BARK_IS_ARCHIVE',
}

function legacyChannels(stored: LegacyConfig): Omit<ChannelState, 'lastStatus' | 'lastError' | 'lastAttemptAt'>[] {
  const enabled = Array.isArray(stored.ENABLED_NOTIFIERS) ? stored.ENABLED_NOTIFIERS : []
  return CHANNELS.map((channel) => {
    const values = CHANNEL_FIELDS[channel].flatMap((field) => {
      const value = stored[field] || stored[LEGACY_CHANNEL_ALIASES[field] ?? '']
      return typeof value === 'string' && value !== '' ? [[field, value] as const] : []
    })
    return { channel, enabled: enabled.includes(channel), config: Object.fromEntries(values) }
  }).filter((channel) => channel.enabled || Object.keys(channel.config).length > 0)
}

// ==================== 訂閱 ====================

type LegacySubscription = Partial<Record<keyof Subscription, unknown>> & {
  id: string
  name: string
  expiryDate: string
  createdAt?: string
  updatedAt?: string
  customType?: string
  isReminderSet?: boolean
  reminderMe?: number
  periodMethod?: string
}

const LEGACY_PAYMENT_LABELS: Record<string, string> = {
  credit: '信用卡',
  apple: 'Apple Pay',
  google: 'Google Pay',
  paypal: 'PayPal',
  other: '其他',
}

const PERIOD_UNITS: readonly PeriodUnit[] = ['day', 'week', 'month', 'year']

// 舊版把日期存成「選定日期 +1 天的 UTC 00:00」時間戳，這裡還原成選定的日曆日期
function legacyDate(value: unknown): CalendarDate | undefined {
  if (isCalendarDate(value)) return value
  if (typeof value !== 'string') return undefined
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? undefined : new Date(ms - 86_400_000).toISOString().slice(0, 10)
}

// 開始日在舊版存成選定日期的 UTC 00:00，只取日期部分
function legacyStartDate(value: unknown): CalendarDate | undefined {
  if (typeof value !== 'string') return undefined
  const date = value.slice(0, 10)
  return isCalendarDate(date) ? date : undefined
}

// 舊版 Cron 把 isReminderSet 為 false 或 reminderMe 為 0 都當成不提醒
function legacyReminder(stored: LegacySubscription): ReminderSetting {
  if (stored.reminder === 'default' || stored.reminder === 'off') return stored.reminder
  if (isIntegerBetween(stored.reminder, 1, 365)) return stored.reminder
  if (!stored.isReminderSet || !stored.reminderMe) return 'off'
  return Math.min(Math.max(Math.round(stored.reminderMe), 1), 365)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeLegacySubscription(stored: LegacySubscription): Subscription {
  const expiryDate = legacyDate(stored.expiryDate)
  if (!expiryDate) throw new Error(`訂閱 ${stored.id}（${stored.name}）的到期日無法轉換：${stored.expiryDate}`)

  const price = Number(stored.price)
  const periodValue = Number(stored.periodValue)
  const createdAt = text(stored.createdAt) || new Date(0).toISOString()
  const paymentMethod =
    typeof stored.paymentMethod === 'string'
      ? stored.paymentMethod
      : stored.periodMethod
        ? (LEGACY_PAYMENT_LABELS[stored.periodMethod] ?? stored.periodMethod)
        : ''

  return {
    id: String(stored.id),
    name: text(stored.name),
    category: text(stored.category) || text(stored.customType),
    currency: text(stored.currency) || 'TWD',
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    periodValue: Number.isInteger(periodValue) && periodValue >= 1 ? periodValue : 1,
    periodUnit: PERIOD_UNITS.includes(stored.periodUnit as PeriodUnit) ? (stored.periodUnit as PeriodUnit) : 'month',
    expiryDate,
    autoRenew: stored.autoRenew !== false,
    isFreeTrial: stored.isFreeTrial === true,
    reminder: legacyReminder(stored),
    cancelByDate: isCalendarDate(stored.cancelByDate) ? stored.cancelByDate : undefined,
    paymentMethod: paymentMethod.trim(),
    website: text(stored.website),
    startDate: legacyStartDate(stored.startDate),
    notes: typeof stored.notes === 'string' ? stored.notes : '',
    isActive: stored.isActive !== false,
    createdAt,
    updatedAt: text(stored.updatedAt) || createdAt,
    lastReminderSentAt: text(stored.lastReminderSentAt) || undefined,
    lastCheckedExpiryDate: legacyDate(stored.lastCheckedExpiryDate),
  }
}

// ==================== Passkey ====================

async function legacyCredentials(kv: KVNamespace, username: string): Promise<StoredCredential[]> {
  const index = parseJson<{ credentialIDs?: string[] }>(
    await kv.get(`webauthn:user:${username}:credentials`),
    'passkey 索引',
  )
  const ids = index?.credentialIDs ?? []
  const credentials = await Promise.all(
    ids.map(async (id) => parseJson<StoredCredential>(await kv.get(`webauthn:credential:${id}`), `passkey ${id}`)),
  )
  return credentials.filter((credential): credential is StoredCredential => credential !== null)
}

function insertLegacyCredential(
  db: D1Database,
  credential: StoredCredential,
  rpId: string | null,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR IGNORE INTO passkey_credentials
         (id, public_key, counter, transports, rp_id, nickname, device_type, backed_up, user_agent, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      credential.credentialID,
      credential.publicKey,
      credential.counter,
      JSON.stringify(credential.transports ?? []),
      rpId,
      credential.nickname ?? null,
      credential.deviceType ?? null,
      credential.backedUp === undefined ? null : credential.backedUp ? 1 : 0,
      credential.userAgent ?? null,
      credential.createdAt,
      credential.lastUsedAt ?? null,
    )
}

// ==================== 共用 ====================

function isIntegerBetween(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max
}

function parseJson<T>(raw: string | null, label: string): T | null {
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    throw new Error(`KV 的 ${label} 不是有效的 JSON`, { cause: error })
  }
}
