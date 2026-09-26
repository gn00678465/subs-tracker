import type { ChannelConfig, ChannelId, ChannelState } from '../../db/settings'
import * as logger from '../../utils/logger'
import { sendBarkNotification, validateBarkConfig } from './channels/bark'
import { sendResendNotification, validateResendConfig } from './channels/resend'
import { sendTelegramNotification, validateTelegramConfig } from './channels/telegram'
import { sendWebhookNotification, validateWebhookConfig } from './channels/webhook'
import type { ChannelResult, ChannelSender, ChannelValidator, NotificationOptions, NotificationResult } from './types'

const CHANNEL_IMPLEMENTATIONS: Record<ChannelId, { send: ChannelSender; validate: ChannelValidator }> = {
  telegram: { send: sendTelegramNotification, validate: validateTelegramConfig },
  bark: { send: sendBarkNotification, validate: validateBarkConfig },
  email: { send: sendResendNotification, validate: validateResendConfig },
  webhook: { send: sendWebhookNotification, validate: validateWebhookConfig },
}

/** 管道缺少的必填欄位；空陣列代表可以發送 */
export function missingFields(channel: ChannelId, config: ChannelConfig): string[] {
  return CHANNEL_IMPLEMENTATIONS[channel].validate(config).missingFields ?? []
}

export async function sendToChannel(
  channel: ChannelId,
  options: NotificationOptions,
  config: ChannelConfig,
): Promise<ChannelResult> {
  try {
    return await CHANNEL_IMPLEMENTATIONS[channel].send(options, config)
  } catch (error) {
    logger.error(`渠道 ${channel} 發送異常`, error, { prefix: 'Notifier' })
    return { channel, success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/** 發送通知到所有啟用的管道 */
export async function sendNotificationToAllChannels(
  options: NotificationOptions,
  channels: ChannelState[],
): Promise<NotificationResult> {
  const { title, content } = options
  const enabledChannels = channels.filter((channel) => channel.enabled)

  if (enabledChannels.length === 0) {
    logger.notification('沒有啟用任何通知渠道')
    return { totalChannels: 0, successCount: 0, failureCount: 0, results: [] }
  }

  logger.notification(`開始發送通知: ${title}`, {
    data: { enabledChannels: enabledChannels.map((c) => c.channel), content },
  })

  const results = await Promise.all(enabledChannels.map((c) => sendToChannel(c.channel, options, c.config)))

  const successCount = results.filter((r) => r.success).length
  const failureCount = results.filter((r) => !r.success).length

  logger.notification(`通知發送完成: 成功 ${successCount}/${results.length}`, {
    data: {
      title,
      successCount,
      failureCount,
      results: results.map((r) => ({
        channel: r.channel,
        success: r.success,
        error: r.error,
      })),
    },
  })

  return {
    totalChannels: results.length,
    successCount,
    failureCount,
    results,
  }
}
