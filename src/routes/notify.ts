import type { HonoEnv } from '@/types'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { getConfig } from '@/services/config'
import { sendNotificationToAllChannels } from '@/services/notifier'
import * as logger from '@/utils/logger'

// 創建第三方通知路由實例
const notify = new OpenAPIHono<HonoEnv>()

// 通知請求的 Schema
const NotifyRequestSchema = z.object({
  title: z.string().optional().default('第三方通知').openapi({
    example: '系統通知',
    description: '通知標題',
  }),
  content: z.string().min(1, '通知內容不能為空').openapi({
    example: '這是一條測試通知',
    description: '通知內容',
  }),
  tags: z.union([
    z.array(z.string()),
    z.string(),
  ]).optional().openapi({
    example: ['測試', '重要'],
    description: '標籤列表（可以是陣列或逗號分隔的字符串）',
  }),
})

// 成功響應 Schema
const NotifySuccessResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  data: z.object({
    msgid: z.string().openapi({ example: 'MSGID1703123456789' }),
    totalChannels: z.number().openapi({ example: 3 }),
    successCount: z.number().openapi({ example: 2 }),
  }),
  message: z.string().optional().openapi({
    example: '發送成功 (2/3)',
  }),
})

// 錯誤響應 Schema
const NotifyErrorResponseSchema = z.object({
  success: z.boolean().openapi({ example: false }),
  message: z.string().openapi({
    example: '訪問未授權，令牌無效或缺失',
  }),
  errors: z.array(z.object({
    path: z.string(),
    message: z.string(),
  })).optional(),
  code: z.string().optional().openapi({
    example: 'UNAUTHORIZED',
  }),
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
 * POST /api/notify/:token 路由定義
 */
const notifyRoute = createRoute({
  method: 'post',
  path: '/{token}',
  tags: ['Notify'],
  summary: '第三方通知觸發',
  description: '通過第三方 API Token 觸發多渠道通知發送。支援三種 Token 傳遞方式：URL 路徑、Authorization Header、Query 參數。',
  request: {
    params: z.object({
      token: z.string().optional().openapi({
        param: {
          name: 'token',
          in: 'path',
        },
        example: 'your-api-token-here',
        description: 'API Token（可選，也可通過 Header 或 Query 傳遞）',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: NotifyRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: NotifySuccessResponseSchema,
        },
      },
      description: '通知發送成功（至少一個渠道成功）',
    },
    400: {
      content: {
        'application/json': {
          schema: NotifyErrorResponseSchema,
        },
      },
      description: '請求驗證失敗或未啟用任何通知渠道',
    },
    401: {
      content: {
        'application/json': {
          schema: NotifyErrorResponseSchema,
        },
      },
      description: 'Token 無效或缺失',
    },
    403: {
      content: {
        'application/json': {
          schema: NotifyErrorResponseSchema,
        },
      },
      description: '第三方 API 已禁用',
    },
    500: {
      content: {
        'application/json': {
          schema: NotifyErrorResponseSchema,
        },
      },
      description: '服務器錯誤',
    },
  },
})

/**
 * POST /api/notify/:token
 * 第三方 API 觸發通知
 * 支持通過路徑參數、Header 或 Query 參數傳遞 Token
 */
notify.openapi(notifyRoute, async (c) => {
  try {
    // 驗證 API Token
    const tokenValidation = await verifyApiToken(c)
    if (!tokenValidation.valid) {
      logger.warning(`第三方 API Token 驗證失敗: ${tokenValidation.message}`, { prefix: 'Notify' })
      if (tokenValidation.message?.includes('禁用')) {
        return c.json({
          success: false,
          message: tokenValidation.message,
          code: 'FORBIDDEN',
        }, 403)
      }
      return c.json({
        success: false,
        message: tokenValidation.message || '訪問未授權',
        code: 'UNAUTHORIZED',
      }, 401)
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

    // 發送通知到所有渠道
    const config = await getConfig(c.env)
    const result = await sendNotificationToAllChannels(
      {
        title,
        content,
        timestamp: new Date().toISOString(),
        metadata: { tags: bodyTags, source: '第三方API' },
      },
      config,
    )

    logger.info(`第三方通知發送完成: 成功 ${result.successCount}/${result.totalChannels}`, {
      prefix: 'Notify',
      data: result,
    })

    // 部分成功也返回成功（容錯設計）
    if (result.successCount > 0) {
      return c.json({
        success: true,
        data: {
          msgid: `MSGID${Date.now()}`,
          totalChannels: result.totalChannels,
          successCount: result.successCount,
        },
        message: `發送成功 (${result.successCount}/${result.totalChannels})`,
      }, 200)
    }
    else if (result.totalChannels === 0) {
      return c.json({
        success: false,
        message: '沒有啟用任何通知渠道，請在配置頁面啟用並配置',
        code: 'NO_CHANNELS',
      }, 400)
    }
    else {
      return c.json({
        success: false,
        message: '所有通知渠道發送失敗',
        code: 'ALL_FAILED',
      }, 500)
    }
  }
  catch (error) {
    logger.error('第三方 API 發送通知失敗', error, { prefix: 'Notify' })
    return c.json({
      success: false,
      message: '第三方 API 發送通知失敗',
      code: 'INTERNAL_ERROR',
    }, 500)
  }
})

export default notify
