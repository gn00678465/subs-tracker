import type { ChannelSender, ChannelValidator } from '../types'
import * as logger from '../../../utils/logger'
import { renderTemplate } from '../utils/template'

/**
 * 驗證 Webhook 配置
 */
export const validateWebhookConfig: ChannelValidator = (config) => {
  const missingFields: string[] = []

  if (!config.WEBHOOK_URL)
    missingFields.push('WEBHOOK_URL')

  return {
    isValid: missingFields.length === 0,
    missingFields: missingFields.length > 0 ? missingFields : undefined,
  }
}

/**
 * 發送 Webhook 通知
 */
export const sendWebhookNotification: ChannelSender = async (options, config) => {
  const channelName = 'webhook'

  try {
    // 配置驗證
    const validation = validateWebhookConfig(config)
    if (!validation.isValid) {
      return {
        channel: channelName,
        success: false,
        error: `配置缺失: ${validation.missingFields?.join(', ')}`,
      }
    }

    const { title, content, timestamp = new Date().toISOString() } = options
    const method = (config.WEBHOOK_METHOD || 'POST').toUpperCase()

    // 解析自定義 Headers
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (config.WEBHOOK_HEADERS) {
      try {
        const customHeaders = JSON.parse(config.WEBHOOK_HEADERS)
        headers = { ...headers, ...customHeaders }
      }
      catch (error) {
        logger.warning('Webhook Headers 解析失敗，使用預設值', { prefix: 'Notifier' })
      }
    }

    // 渲染請求體模板
    let body: string | undefined
    if (method !== 'GET' && method !== 'HEAD') {
      const template = config.WEBHOOK_TEMPLATE || '{"title":"{{title}}","content":"{{content}}","timestamp":"{{timestamp}}"}'
      const renderResult = renderTemplate(template, { title, content, timestamp })

      if (!renderResult.success) {
        return {
          channel: channelName,
          success: false,
          error: `模板渲染失敗: ${renderResult.error}`,
        }
      }

      body = renderResult.rendered
    }

    // 發送請求
    const response = await fetch(config.WEBHOOK_URL!, {
      method,
      headers,
      body,
    })

    const isSuccess = response.ok
    const responseText = await response.text()

    if (!isSuccess) {
      logger.notification(`Webhook 發送失敗: HTTP ${response.status}`, {
        data: { status: response.status, body: responseText },
      })
      return {
        channel: channelName,
        success: false,
        error: `HTTP ${response.status}`,
        details: { status: response.status, body: responseText },
      }
    }

    logger.notification(`Webhook 發送成功: HTTP ${response.status}`)
    return {
      channel: channelName,
      success: true,
      message: '發送成功',
      details: { status: response.status, body: responseText },
    }
  }
  catch (error) {
    logger.error('Webhook 發送異常', error, { prefix: 'Notifier' })
    return {
      channel: channelName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
