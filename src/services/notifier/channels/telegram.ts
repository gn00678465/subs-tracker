import type { ChannelSender, ChannelValidator } from '../types'
import * as logger from '../../../utils/logger'

/**
 * 驗證 Telegram 配置
 */
export const validateTelegramConfig: ChannelValidator = (config) => {
  const missingFields: string[] = []

  if (!config.TELEGRAM_BOT_TOKEN)
    missingFields.push('TELEGRAM_BOT_TOKEN')
  if (!config.TELEGRAM_CHAT_ID)
    missingFields.push('TELEGRAM_CHAT_ID')

  return {
    isValid: missingFields.length === 0,
    missingFields: missingFields.length > 0 ? missingFields : undefined,
  }
}

/**
 * 發送 Telegram 通知
 * API: https://core.telegram.org/bots/api#sendmessage
 */
export const sendTelegramNotification: ChannelSender = async (options, config) => {
  const channelName = 'telegram'

  try {
    // 配置驗證
    const validation = validateTelegramConfig(config)
    if (!validation.isValid) {
      return {
        channel: channelName,
        success: false,
        error: `配置缺失: ${validation.missingFields?.join(', ')}`,
      }
    }

    const { title, content } = options
    const text = `*${title}*\n\n${content}`

    const url = `https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
      }),
    })

    const result = await response.json() as any

    if (!response.ok) {
      logger.notification(`Telegram 發送失敗: ${result.description || 'Unknown error'}`, {
        data: { status: response.status, result },
      })
      return {
        channel: channelName,
        success: false,
        error: result.description || `HTTP ${response.status}`,
        details: result,
      }
    }

    logger.notification(`Telegram 發送成功: message_id=${result.result?.message_id}`)
    return {
      channel: channelName,
      success: true,
      message: '發送成功',
      details: result.result,
    }
  }
  catch (error) {
    logger.error('Telegram 發送異常', error, { prefix: 'Notifier' })
    return {
      channel: channelName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
