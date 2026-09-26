import { Resend } from 'resend'

import * as logger from '../../../utils/logger'
import type { ChannelSender, ChannelValidator } from '../types'

/**
 * HTML 轉義函數，防止 XSS 攻擊
 */
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return text.replace(/[&<>"']/g, (char) => htmlEscapeMap[char] || char)
}

/**
 * 生成郵件 HTML 模板
 */
function generateEmailHtml(title: string, content: string): string {
  const escapedTitle = escapeHtml(title)
  const escapedContent = escapeHtml(content).replace(/\n/g, '<br>')

  return `<div style="font-family: sans-serif; line-height: 1.6;">
    <h2 style="color: #333;">${escapedTitle}</h2>
    <p style="color: #666;">${escapedContent}</p>
    <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
    <p style="color: #999; font-size: 12px;">來自 SubsTracker 訂閱管理系統</p>
  </div>`
}

/**
 * 驗證 Resend 配置
 */
export const validateResendConfig: ChannelValidator = (config) => {
  const missingFields: string[] = []

  if (!config.RESEND_API_KEY) missingFields.push('RESEND_API_KEY')
  if (!config.EMAIL_FROM) missingFields.push('EMAIL_FROM')
  if (!config.EMAIL_TO) missingFields.push('EMAIL_TO')

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

  // 配置驗證
  const validation = validateResendConfig(config)
  if (!validation.isValid) {
    return {
      channel: channelName,
      success: false,
      error: `配置缺失: ${validation.missingFields?.join(', ')}`,
    }
  }

  // 類型守衛：驗證後確保必要欄位存在
  const apiKey = config.RESEND_API_KEY
  const emailFrom = config.EMAIL_FROM
  const emailTo = config.EMAIL_TO
  if (!apiKey || !emailFrom || !emailTo) {
    return {
      channel: channelName,
      success: false,
      error: '配置驗證失敗',
    }
  }

  const resend = new Resend(apiKey)
  const { title, content } = options

  const { data, error } = await resend.emails.send({
    from: config.EMAIL_FROM_NAME ? `${config.EMAIL_FROM_NAME} <${emailFrom}>` : emailFrom,
    to: [emailTo],
    subject: title,
    html: generateEmailHtml(title, content),
  })

  if (error) {
    logger.notification(`Resend 發送失敗: ${error.message || 'Unknown error'}`, {
      data: { status: error.statusCode, error },
    })
    return {
      channel: channelName,
      success: false,
      error: error.message || `HTTP ${error.statusCode}`,
    }
  }

  logger.notification(`Resend 發送成功: email_id=${data.id}`)
  return {
    channel: channelName,
    success: true,
  }
}
