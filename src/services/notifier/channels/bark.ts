import type { ChannelSender, ChannelValidator } from '../types'
import * as logger from '../../../utils/logger'

/**
 * 驗證 Bark 配置
 */
export const validateBarkConfig: ChannelValidator = (config) => {
  const missingFields: string[] = []

  if (!config.BARK_KEY)
    missingFields.push('BARK_KEY')

  return {
    isValid: missingFields.length === 0,
    missingFields: missingFields.length > 0 ? missingFields : undefined,
  }
}

/**
 * 發送 Bark 通知
 * API: https://bark.day.app/#api-v2
 */
export const sendBarkNotification: ChannelSender = async (options, config) => {
  const channelName = 'bark'

  try {
    // 配置驗證
    const validation = validateBarkConfig(config)
    if (!validation.isValid) {
      return {
        channel: channelName,
        success: false,
        error: `配置缺失: ${validation.missingFields?.join(', ')}`,
      }
    }

    const { title, content } = options
    const server = (config.BARK_SERVER || 'https://api.day.app').replace(/\/$/, '') // 移除尾部斜線
    const shouldSave = config.BARK_SAVE === 'true' || config.BARK_SAVE === '1'

    // Bark API v2: POST {server}/push
    const url = `${server}/push`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_key: config.BARK_KEY,
        title,
        body: content,
        isArchive: shouldSave ? 1 : 0,
      }),
    })

    const result = await response.json() as any

    if (!response.ok || result.code !== 200) {
      logger.notification(`Bark 發送失敗: ${result.message || 'Unknown error'}`, {
        data: { status: response.status, result },
      })
      return {
        channel: channelName,
        success: false,
        error: result.message || `HTTP ${response.status}`,
        details: result,
      }
    }

    logger.notification('Bark 發送成功')
    return {
      channel: channelName,
      success: true,
      message: '發送成功',
      details: result,
    }
  }
  catch (error) {
    logger.error('Bark 發送異常', error, { prefix: 'Notifier' })
    return {
      channel: channelName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
