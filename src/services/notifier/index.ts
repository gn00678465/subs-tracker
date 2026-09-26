import type { Config } from '../../types'
import * as logger from '../../utils/logger'
import { sendBarkNotification } from './channels/bark'
import { sendResendNotification } from './channels/resend'
import { sendTelegramNotification } from './channels/telegram'
import { sendWebhookNotification } from './channels/webhook'
import type { ChannelResult, NotificationOptions, NotificationResult } from './types'

/**
 * 渠道映射表
 */
const CHANNEL_SENDERS = {
  telegram: sendTelegramNotification,
  bark: sendBarkNotification,
  email: sendResendNotification,
  webhook: sendWebhookNotification,
} as const

type ChannelName = keyof typeof CHANNEL_SENDERS

/**
 * 發送通知到所有啟用的渠道
 * @param options 通知選項
 * @param config 配置對象
 * @returns 聚合結果
 */
export async function sendNotificationToAllChannels(
  options: NotificationOptions,
  config: Config,
): Promise<NotificationResult> {
  const { title, content } = options

  // 1. 獲取啟用的渠道列表
  const enabledChannels = config.ENABLED_NOTIFIERS || []

  if (enabledChannels.length === 0) {
    logger.notification('沒有啟用任何通知渠道')
    return {
      totalChannels: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
    }
  }

  logger.notification(`開始發送通知: ${title}`, {
    data: { enabledChannels, content },
  })

  // 3. 並行發送到所有渠道（使用 Promise.allSettled）
  const sendPromises = enabledChannels.map(async (channelName) => {
    const sender = CHANNEL_SENDERS[channelName as ChannelName]

    if (!sender) {
      logger.warning(`未知的通知渠道: ${channelName}`, { prefix: 'Notifier' })
      return {
        channel: channelName,
        success: false,
        error: '未知的渠道類型',
      } as ChannelResult
    }

    try {
      return await sender(options, config)
    } catch (error) {
      logger.error(`渠道 ${channelName} 發送異常`, error, { prefix: 'Notifier' })
      return {
        channel: channelName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as ChannelResult
    }
  })

  const settledResults = await Promise.allSettled(sendPromises)

  // 4. 聚合結果
  const results: ChannelResult[] = settledResults.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return {
        channel: enabledChannels[index],
        success: false,
        error: result.reason instanceof Error ? result.reason.message : 'Promise rejected',
      }
    }
  })

  const successCount = results.filter((r) => r.success).length
  const failureCount = results.filter((r) => !r.success).length

  // 5. 記錄摘要
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
