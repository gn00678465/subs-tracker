import type {
  ChannelConfig,
  ChannelField,
  ChannelId,
  ChannelState,
  CronRun,
  ReminderMode,
  Settings,
} from '../db/settings'
import {
  CHANNEL_FIELD_LABELS,
  CHANNEL_FIELDS,
  readChannels,
  readLastCronRun,
  readSettings,
  updateSettings,
  upsertChannel,
} from '../db/settings'
import { listSubscriptions } from '../db/subscriptions'
import type { Bindings, Subscription } from '../types'
import { hashPassword } from '../utils/crypto'
import { UserError } from '../utils/errors'
import { importLegacyData } from './legacyImport'
import { missingFields, sendToChannel } from './notifier'
import type { ChannelResult } from './notifier/types'

/**
 * 第一次讀取時從 KV 匯入；匯入後重新讀取，讓並行的首次請求得到同一組設定。
 * 讀取失敗時丟出錯誤，不改用預設值：預設的時區與提醒時間會讓提醒在錯的時間送出。
 */
export async function loadSettings(env: Bindings, now = new Date()): Promise<Settings> {
  const existing = await readSettings(env.DB)
  if (existing) return existing

  await importLegacyData(env, now)
  const imported = await readSettings(env.DB)
  if (!imported) throw new Error('匯入後讀不到 settings')
  return imported
}

export interface ReminderSettings {
  timezone: string
  reminderHour: number
  reminderMode: ReminderMode
  defaultReminderDays: number
}

export interface ChannelView extends ChannelState {
  missingFields: string[]
}

export interface SettingsView {
  reminder: ReminderSettings
  account: { username: string }
  channels: ChannelView[]
  lastRun: CronRun | null
}

function toChannelView(channel: ChannelState): ChannelView {
  return { ...channel, missingFields: missingFields(channel.channel, channel.config) }
}

export async function readSettingsView(env: Bindings): Promise<SettingsView> {
  const settings = await loadSettings(env)
  const [channels, lastRun] = await Promise.all([readChannels(env.DB), readLastCronRun(env.DB)])
  return {
    reminder: {
      timezone: settings.timezone,
      reminderHour: settings.reminderHour,
      reminderMode: settings.reminderMode,
      defaultReminderDays: settings.defaultReminderDays,
    },
    account: { username: settings.adminUsername },
    channels: channels.map(toChannelView),
    lastRun,
  }
}

export async function saveReminderSettings(env: Bindings, patch: Partial<ReminderSettings>): Promise<void> {
  await loadSettings(env)
  await updateSettings(env.DB, patch, new Date().toISOString())?.run()
}

/** 密碼是明文，寫入前以 jwt_secret 雜湊 */
export async function saveAccount(env: Bindings, patch: { username?: string; password?: string }): Promise<void> {
  const settings = await loadSettings(env)
  const adminPasswordHash = patch.password ? await hashPassword(patch.password, settings.jwtSecret) : undefined
  await updateSettings(env.DB, { adminUsername: patch.username, adminPasswordHash }, new Date().toISOString())?.run()
}

// 只保留這個管道的欄位，空字串代表清除
function cleanChannelConfig(channel: ChannelId, config: ChannelConfig): ChannelConfig {
  return Object.fromEntries(CHANNEL_FIELDS[channel].flatMap((field) => (config[field] ? [[field, config[field]]] : [])))
}

/**
 * 啟用時必填欄位都要有值：沒有提示就讓提醒送不出去，違反「提醒可靠」。
 * 不動 Cron 寫入的 last_* 欄位。
 */
export async function saveChannel(
  env: Bindings,
  channel: ChannelId,
  enabled: boolean,
  config: ChannelConfig,
): Promise<ChannelView> {
  await loadSettings(env)
  const cleaned = cleanChannelConfig(channel, config)
  const missing = missingFields(channel, cleaned)
  if (enabled && missing.length > 0) {
    const labels = missing.map((field) => CHANNEL_FIELD_LABELS[field as ChannelField] ?? field)
    throw new UserError(`啟用前請填寫：${labels.join('、')}`)
  }

  await upsertChannel(env.DB, channel, enabled, cleaned, new Date().toISOString()).run()
  const saved = (await readChannels(env.DB)).find((c) => c.channel === channel)
  if (!saved) throw new Error(`儲存後讀不到管道 ${channel}`)
  return toChannelView(saved)
}

/** 用表單中尚未儲存的值發送；結果不寫入 last_status，避免蓋掉 Cron 真正的失敗狀態 */
export async function testChannel(channel: ChannelId, config: ChannelConfig): Promise<ChannelResult> {
  const cleaned = cleanChannelConfig(channel, config)
  const missing = missingFields(channel, cleaned)
  if (missing.length > 0) throw new UserError(`請先填寫：${missing.join('、')}`)
  return sendToChannel(
    channel,
    {
      title: 'SubsTracker 測試通知',
      content: '收到這則訊息，代表這個通知管道可以正常發送提醒。',
      timestamp: new Date().toISOString(),
    },
    cleaned,
  )
}

export interface ExportData {
  format: 'subs-tracker'
  version: 1
  exportedAt: string
  settings: ReminderSettings & { username: string }
  channels: { channel: ChannelId; enabled: boolean }[]
  subscriptions: Omit<Subscription, 'lastReminderSentAt' | 'lastCheckedExpiryDate'>[]
}

/** 不含密碼雜湊、JWT 金鑰、passkey 與通知管道的憑證 */
export async function exportData(env: Bindings, now: Date): Promise<ExportData> {
  const view = await readSettingsView(env)
  const subscriptions = await listSubscriptions(env.DB)
  return {
    format: 'subs-tracker',
    version: 1,
    exportedAt: now.toISOString(),
    settings: { ...view.reminder, username: view.account.username },
    channels: view.channels.map(({ channel, enabled }) => ({ channel, enabled })),
    subscriptions: subscriptions.map(({ lastReminderSentAt: _sent, lastCheckedExpiryDate: _checked, ...rest }) => rest),
  }
}
