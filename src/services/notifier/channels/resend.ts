import type { ChannelSender, ChannelValidator } from '../types'
import * as logger from '../../../utils/logger'

/**
 * 驗證 Resend 配置
 */
export const validateResendConfig: ChannelValidator = (config) => {
  const missingFields: string[] = []

  if (!config.RESEND_API_KEY)
    missingFields.push('RESEND_API_KEY')
  if (!config.EMAIL_FROM)
    missingFields.push('EMAIL_FROM')
  if (!config.EMAIL_TO)
    missingFields.push('EMAIL_TO')

  return {
    isValid: missingFields.length === 0,
    missingFields: missingFields.length > 0 ? missingFields : undefined,
  }
}

/**
 * 發送 Resend 郵件通知
 * API: https://resend.com/docs/api-reference/emails/send-email
 */
export const sendResendNotification: ChannelSender = async (options, config) => {
  const channelName = 'email'

  try {
    // 配置驗證
    const validation = validateResendConfig(config)
    if (!validation.isValid) {
      return {
        channel: channelName,
        success: false,
        error: `配置缺失: ${validation.missingFields?.join(', ')}`,
      }
    }

    const { title, content } = options

    const url = 'https://api.resend.com/emails'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: config.EMAIL_FROM_NAME
          ? `${config.EMAIL_FROM_NAME} <${config.EMAIL_FROM}>`
          : config.EMAIL_FROM,
        to: [config.EMAIL_TO],
        subject: title,
        html: `<div style="font-family: sans-serif; line-height: 1.6;">
          <h2 style="color: #333;">${title}</h2>
          <p style="color: #666;">${content.replace(/\n/g, '<br>')}</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #999; font-size: 12px;">來自 SubsTracker 訂閱管理系統</p>
        </div>`,
      }),
    })

    const result = await response.json() as any

    if (!response.ok) {
      logger.notification(`Resend 發送失敗: ${result.message || 'Unknown error'}`, {
        data: { status: response.status, result },
      })
      return {
        channel: channelName,
        success: false,
        error: result.message || `HTTP ${response.status}`,
        details: result,
      }
    }

    logger.notification(`Resend 發送成功: email_id=${result.id}`)
    return {
      channel: channelName,
      success: true,
      message: '發送成功',
      details: result,
    }
  }
  catch (error) {
    logger.error('Resend 發送異常', error, { prefix: 'Notifier' })
    return {
      channel: channelName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
