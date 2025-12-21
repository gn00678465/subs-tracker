import type { Config } from '../../types'
import type { ChannelResult, NotificationOptions, NotificationResult } from './types'
import * as logger from '../../utils/logger'
import { isNotificationAllowedAtHour } from '../config'
import { sendBarkNotification } from './channels/bark'
import { sendResendNotification } from './channels/resend'
import { sendTelegramNotification } from './channels/telegram'
import { sendWebhookNotification } from './channels/webhook'

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

  // 1. 檢查通知時段
  const currentHour = new Date().getHours()
  const isAllowed = isNotificationAllowedAtHour(config, currentHour)

  if (!isAllowed) {
    logger.notification(`當前時段（${currentHour}時）不在允許的通知時段內，跳過發送`, {
      data: { allowedHours: config.NOTIFICATION_HOURS },
    })
    return {
      totalChannels: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
    }
  }

  // 2. 獲取啟用的渠道列表
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
    }
    catch (error) {
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
    }
    else {
      return {
        channel: enabledChannels[index],
        success: false,
        error: result.reason instanceof Error ? result.reason.message : 'Promise rejected',
      }
    }
  })

  const successCount = results.filter(r => r.success).length
  const failureCount = results.filter(r => !r.success).length

  // 5. 記錄摘要
  logger.notification(`通知發送完成: 成功 ${successCount}/${results.length}`, {
    data: {
      title,
      successCount,
      failureCount,
      results: results.map(r => ({
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

/**
 * 發送單個訂閱的提醒通知
 * @param subscriptionName 訂閱名稱
 * @param expiryDate 到期日期
 * @param daysLeft 剩餘天數
 * @param config 配置對象
 */
export async function sendSubscriptionReminder(
  subscriptionName: string,
  expiryDate: string,
  daysLeft: number,
  config: Config,
): Promise<NotificationResult> {
  const title = `訂閱到期提醒: ${subscriptionName}`
  const content = `您的訂閱「${subscriptionName}」將在 ${daysLeft} 天後到期\n\n到期日期: ${expiryDate}\n\n請及時處理續費事宜。`

  return sendNotificationToAllChannels(
    {
      title,
      content,
      timestamp: new Date().toISOString(),
      metadata: { subscriptionName, expiryDate, daysLeft },
    },
    config,
  )
}
