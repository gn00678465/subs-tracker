export type ReminderMode = 'ONCE' | 'DAILY'

export interface Settings {
  adminUsername: string
  adminPasswordHash: string
  jwtSecret: string
  timezone: string
  reminderHour: number
  reminderMode: ReminderMode
  defaultReminderDays: number
  webauthnUserHandle: string | null
}

export const CHANNELS = ['telegram', 'email', 'webhook', 'bark'] as const
export type ChannelId = (typeof CHANNELS)[number]

// 每個管道的憑證與進階欄位，名稱沿用通知程式讀取的 Config 欄位
export const CHANNEL_FIELDS = {
  telegram: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'],
  email: ['RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_FROM_NAME', 'EMAIL_TO'],
  webhook: ['WEBHOOK_URL', 'WEBHOOK_METHOD', 'WEBHOOK_HEADERS', 'WEBHOOK_TEMPLATE'],
  bark: ['BARK_SERVER', 'BARK_KEY', 'BARK_SAVE', 'BARK_QUERY'],
} as const satisfies Record<ChannelId, readonly string[]>

export type ChannelField = (typeof CHANNEL_FIELDS)[ChannelId][number]

/** 設定頁的欄位名稱，也用在伺服器的錯誤訊息 */
export const CHANNEL_FIELD_LABELS: Record<ChannelField, string> = {
  TELEGRAM_BOT_TOKEN: 'Bot Token',
  TELEGRAM_CHAT_ID: 'Chat ID',
  RESEND_API_KEY: 'Resend API Key',
  EMAIL_FROM: '寄件地址',
  EMAIL_FROM_NAME: '寄件人名稱',
  EMAIL_TO: '收件地址',
  WEBHOOK_URL: '網址',
  WEBHOOK_METHOD: '方法',
  WEBHOOK_HEADERS: '標頭（JSON）',
  WEBHOOK_TEMPLATE: '內容範本（JSON）',
  BARK_SERVER: '伺服器',
  BARK_KEY: '裝置 Key',
  BARK_SAVE: '保存到 Bark 歷史紀錄',
  BARK_QUERY: '查詢參數',
}

export type ChannelConfig = Partial<Record<ChannelField, string>>

export interface ChannelState {
  channel: ChannelId
  enabled: boolean
  config: ChannelConfig
  lastStatus: 'ok' | 'failed' | null
  lastError: string | null
  lastAttemptAt: string | null
}

interface SettingsRow {
  admin_username: string
  admin_password_hash: string
  jwt_secret: string
  timezone: string
  reminder_hour: number
  reminder_mode: ReminderMode
  default_reminder_days: number
  webauthn_user_handle: string | null
}

interface ChannelRow {
  channel: ChannelId
  enabled: number
  config: string
  last_status: 'ok' | 'failed' | null
  last_error: string | null
  last_attempt_at: string | null
}

export async function readSettings(db: D1Database): Promise<Settings | null> {
  const row = await db.prepare('SELECT * FROM settings WHERE id = 1').first<SettingsRow>()
  if (!row) return null
  return {
    adminUsername: row.admin_username,
    adminPasswordHash: row.admin_password_hash,
    jwtSecret: row.jwt_secret,
    timezone: row.timezone,
    reminderHour: row.reminder_hour,
    reminderMode: row.reminder_mode,
    defaultReminderDays: row.default_reminder_days,
    webauthnUserHandle: row.webauthn_user_handle,
  }
}

/** 只在 settings 還沒有資料時寫入；並行的首次請求只有一個會成功 */
export function insertSettingsIfAbsent(db: D1Database, settings: Settings, now: string): D1PreparedStatement {
  return db
    .prepare(
      `INSERT OR IGNORE INTO settings
         (id, admin_username, admin_password_hash, jwt_secret, timezone, reminder_hour, reminder_mode, default_reminder_days, webauthn_user_handle, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      settings.adminUsername,
      settings.adminPasswordHash,
      settings.jwtSecret,
      settings.timezone,
      settings.reminderHour,
      settings.reminderMode,
      settings.defaultReminderDays,
      settings.webauthnUserHandle,
      now,
    )
}

const SETTINGS_COLUMNS = {
  adminUsername: 'admin_username',
  adminPasswordHash: 'admin_password_hash',
  timezone: 'timezone',
  reminderHour: 'reminder_hour',
  reminderMode: 'reminder_mode',
  defaultReminderDays: 'default_reminder_days',
  webauthnUserHandle: 'webauthn_user_handle',
} as const satisfies Partial<Record<keyof Settings, string>>

export type SettingsPatch = Partial<Pick<Settings, keyof typeof SETTINGS_COLUMNS>>

/** 只更新有傳入的欄位；沒有要更新的欄位時回傳 null */
export function updateSettings(db: D1Database, patch: SettingsPatch, now: string): D1PreparedStatement | null {
  const keys = (Object.keys(SETTINGS_COLUMNS) as (keyof typeof SETTINGS_COLUMNS)[]).filter(
    (key) => patch[key] !== undefined,
  )
  if (keys.length === 0) return null
  const assignments = keys.map((key) => `${SETTINGS_COLUMNS[key]} = ?`).join(', ')
  return db
    .prepare(`UPDATE settings SET ${assignments}, updated_at = ? WHERE id = 1`)
    .bind(...keys.map((key) => patch[key] ?? null), now)
}

export async function readChannels(db: D1Database): Promise<ChannelState[]> {
  const { results } = await db.prepare('SELECT * FROM notification_channels').all<ChannelRow>()
  const byId = new Map(results.map((row) => [row.channel, row]))
  return CHANNELS.map((channel) => {
    const row = byId.get(channel)
    return {
      channel,
      enabled: row?.enabled === 1,
      config: row ? (JSON.parse(row.config) as ChannelConfig) : {},
      lastStatus: row?.last_status ?? null,
      lastError: row?.last_error ?? null,
      lastAttemptAt: row?.last_attempt_at ?? null,
    }
  })
}

/** 使用者儲存管道設定；不動 Cron 寫入的 last_* 欄位 */
export function upsertChannel(
  db: D1Database,
  channel: ChannelId,
  enabled: boolean,
  config: ChannelConfig,
  now: string,
  { ignoreExisting = false } = {},
): D1PreparedStatement {
  const conflict = ignoreExisting
    ? 'DO NOTHING'
    : 'DO UPDATE SET enabled = excluded.enabled, config = excluded.config, updated_at = excluded.updated_at'
  return db
    .prepare(
      `INSERT INTO notification_channels (channel, enabled, config, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(channel) ${conflict}`,
    )
    .bind(channel, enabled ? 1 : 0, JSON.stringify(config), now)
}

/** Cron 記錄某個管道最近一次發送的結果 */
export function recordChannelResult(
  db: D1Database,
  channel: ChannelId,
  status: 'ok' | 'failed',
  error: string | null,
  at: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO notification_channels (channel, last_status, last_error, last_attempt_at, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(channel) DO UPDATE SET last_status = excluded.last_status, last_error = excluded.last_error, last_attempt_at = excluded.last_attempt_at`,
    )
    .bind(channel, status, error, at, at)
}

export interface CronRun {
  localDate: string
  startedAt: string
  finishedAt: string | null
  reminded: number
  failed: number
  error: string | null
}

export async function readLastCronRun(db: D1Database): Promise<CronRun | null> {
  const row = await db
    .prepare(
      `SELECT local_date AS localDate, started_at AS startedAt, finished_at AS finishedAt, reminded, failed, error
       FROM cron_runs ORDER BY id DESC LIMIT 1`,
    )
    .first<CronRun>()
  return row ?? null
}
