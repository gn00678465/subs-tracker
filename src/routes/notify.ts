import type { HonoEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { getConfig } from '../services/config'
import * as logger from '../utils/logger'
import { forbidden, serverError, success, unauthorized, validationError } from '../utils/response'

// 創建第三方通知路由實例
const notify = new Hono<HonoEnv>()

// 通知請求的 Schema
const notifySchema = z.object({
  title: z.string().optional().default('第三方通知'),
  content: z.string().min(1, '通知內容不能為空'),
  tags: z.union([
    z.array(z.string()),
    z.string(),
  ]).optional(),
})

/**
 * 驗證第三方 API Token
 * 支持三種方式傳遞 Token：
 * 1. URL 路徑參數：/api/notify/:token
 * 2. Authorization Header：Bearer <token>
 * 3. Query 參數：?token=xxx
 */
async function verifyApiToken(c: any): Promise<{ valid: boolean, message?: string }> {
  const config = await getConfig(c.env)
  const expectedToken = config.API_TOKEN || ''

  // 如果未配置 API_TOKEN，則禁用第三方 API
  if (!expectedToken) {
    return {
      valid: false,
      message: '第三方 API 已禁用，請在後台配置訪問令牌後使用',
    }
  }

  // 從多個來源提取 Token（優先級：路徑 > Header > Query）
  const tokenFromPath = c.req.param('token') || ''
  const authHeader = c.req.header('Authorization') || ''
  const tokenFromHeader = authHeader.replace(/^Bearer\s+/i, '').trim()
  const tokenFromQuery = c.req.query('token') || ''

  const providedToken = tokenFromPath || tokenFromHeader || tokenFromQuery

  // 驗證 Token
  if (!providedToken || providedToken !== expectedToken) {
    return {
      valid: false,
      message: '訪問未授權，令牌無效或缺失',
    }
  }

  return { valid: true }
}

/**
 * POST /api/notify/:token
 * 第三方 API 觸發通知
 * 支持通過路徑參數、Header 或 Query 參數傳遞 Token
 */
notify.post('/:token?', zValidator('json', notifySchema, (result, c) => {
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    return validationError(c, '請求數據驗證失敗', errors)
  }
}), async (c) => {
  try {
    // 驗證 API Token
    const tokenValidation = await verifyApiToken(c)
    if (!tokenValidation.valid) {
      logger.warning(`第三方 API Token 驗證失敗: ${tokenValidation.message}`, { prefix: 'Notify' })
      if (tokenValidation.message?.includes('禁用')) {
        return forbidden(c, tokenValidation.message)
      }
      return unauthorized(c, tokenValidation.message || '訪問未授權')
    }

    const { title, content, tags } = c.req.valid('json')

    logger.info(`第三方 API 觸發通知: ${title}`, { prefix: 'Notify' })

    // 處理標籤
    const bodyTagsRaw = Array.isArray(tags)
      ? tags
      : (typeof tags === 'string' ? tags.split(/[,，\s]+/) : [])
    const bodyTags = bodyTagsRaw
      .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
      .map(tag => tag.trim())

    // TODO: Phase 6 - 實現多渠道通知發送
    // await sendNotificationToAllChannels(title, content, config, '[第三方API]', {
    //   metadata: { tags: bodyTags }
    // })

    logger.info('第三方通知發送成功（待實現多渠道發送）', {
      prefix: 'Notify',
      data: { title, content, tags: bodyTags },
    })

    return success(c, { msgid: `MSGID${Date.now()}` }, '發送成功')
  }
  catch (error) {
    logger.error('第三方 API 發送通知失敗', error, { prefix: 'Notify' })
    return serverError(c, '第三方 API 發送通知失敗')
  }
})

export default notify
