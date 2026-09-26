import type { ChannelId } from '../../db/settings'

export const CHANNEL_LABEL: Record<ChannelId, string> = {
  telegram: 'Telegram',
  email: 'Email',
  webhook: 'Webhook',
  bark: 'Bark',
}

/** 例如 9/26 09:00，依使用者設定的時區 */
export function formatDateTime(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`
}

export function timezoneName(timezone: string): string {
  const parts = new Intl.DateTimeFormat('zh-TW', { timeZone: timezone, timeZoneName: 'shortGeneric' }).formatToParts()
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? timezone
}
