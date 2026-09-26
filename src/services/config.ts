import type { ChannelField, ChannelId, ChannelState, Settings, SettingsPatch } from '../db/settings'
import { CHANNEL_FIELDS, readChannels, readSettings, updateSettings, upsertChannel } from '../db/settings'
import type { Bindings, Config } from '../types'
import { hashPassword } from '../utils/crypto'
import { importLegacyData } from './legacyImport'

// 使用者沒有填寫時，通知程式使用的值
const CHANNEL_DEFAULTS: Partial<Record<ChannelField, string>> = {
  BARK_SERVER: 'https://api.day.app',
  BARK_SAVE: 'false',
  WEBHOOK_METHOD: 'POST',
}

/** 第一次讀取時從 KV 匯入；匯入後重新讀取，讓並行的首次請求得到同一組設定 */
export async function loadSettings(env: Bindings, now = new Date()): Promise<Settings> {
  const existing = await readSettings(env.DB)
  if (existing) return existing

  await importLegacyData(env, now)
  const imported = await readSettings(env.DB)
  if (!imported) throw new Error('匯入後讀不到 settings')
  return imported
}

function toConfig(settings: Settings, channels: ChannelState[]): Config {
  const channelValues = Object.assign({}, ...channels.map((channel) => channel.config)) as Config
  return {
    ...CHANNEL_DEFAULTS,
    ...channelValues,
    ADMIN_USERNAME: settings.adminUsername,
    ADMIN_PASSWORD: settings.adminPasswordHash,
    JWT_SECRET: settings.jwtSecret,
    TIMEZONE: settings.timezone,
    REMINDER_HOUR: settings.reminderHour,
    REMINDER_MODE: settings.reminderMode,
    DEFAULT_REMINDER_DAYS: settings.defaultReminderDays,
    ENABLED_NOTIFIERS: channels.filter((channel) => channel.enabled).map((channel) => channel.channel),
  }
}

/** 讀取失敗時丟出錯誤，不改用預設值：預設的時區與提醒時間會讓提醒在錯的時間送出 */
export async function getConfig(env: Bindings): Promise<Config> {
  const settings = await loadSettings(env)
  return toConfig(settings, await readChannels(env.DB))
}

export type ConfigPatch = Partial<
  Pick<
    Config,
    | 'ADMIN_USERNAME'
    | 'ADMIN_PASSWORD'
    | 'TIMEZONE'
    | 'REMINDER_HOUR'
    | 'REMINDER_MODE'
    | 'DEFAULT_REMINDER_DAYS'
    | 'ENABLED_NOTIFIERS'
    | ChannelField
  >
>

/** ADMIN_PASSWORD 是明文，寫入前雜湊；管道欄位的空字串代表清除 */
export async function updateConfig(patch: ConfigPatch, env: Bindings): Promise<void> {
  const settings = await loadSettings(env)
  const now = new Date().toISOString()

  const settingsPatch: SettingsPatch = {
    adminUsername: patch.ADMIN_USERNAME,
    adminPasswordHash: patch.ADMIN_PASSWORD ? await hashPassword(patch.ADMIN_PASSWORD, settings.jwtSecret) : undefined,
    timezone: patch.TIMEZONE,
    reminderHour: patch.REMINDER_HOUR,
    reminderMode: patch.REMINDER_MODE,
    defaultReminderDays: patch.DEFAULT_REMINDER_DAYS,
  }

  const channels = await readChannels(env.DB)
  const changedChannels = channels.filter(
    (channel) =>
      patch.ENABLED_NOTIFIERS !== undefined || CHANNEL_FIELDS[channel.channel].some((field) => field in patch),
  )

  const statements = [
    ...changedChannels.map((channel) =>
      upsertChannel(
        env.DB,
        channel.channel,
        patch.ENABLED_NOTIFIERS ? patch.ENABLED_NOTIFIERS.includes(channel.channel) : channel.enabled,
        mergeChannelConfig(channel.channel, channel.config, patch),
        now,
      ),
    ),
    updateSettings(env.DB, settingsPatch, now),
  ].filter((statement) => statement !== null)
  if (statements.length > 0) await env.DB.batch(statements)
}

function mergeChannelConfig(
  channel: ChannelId,
  current: ChannelState['config'],
  patch: ConfigPatch,
): ChannelState['config'] {
  const entries = CHANNEL_FIELDS[channel].flatMap((field) => {
    const value = field in patch ? patch[field] : current[field]
    return value ? [[field, value] as const] : []
  })
  return Object.fromEntries(entries)
}
