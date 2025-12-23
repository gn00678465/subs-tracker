import type { Config, HonoEnv } from '../types'

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { authMiddleware } from '../middleware/auth'
import { getConfig, updateConfig } from '../services/config'
import * as logger from '../utils/logger'

// 創建配置路由實例
const config = new OpenAPIHono<HonoEnv>()

// 更新配置的 Schema（所有字段都是可選的）
const updateConfigSchema = z.object({
  ADMIN_USERNAME: z.string().min(1).optional().openapi({
    example: 'admin',
    description: '管理員用戶名',
  }),
  ADMIN_PASSWORD: z.string().min(6, '密碼至少需要 6 個字符').optional().openapi({
    example: 'newpassword123',
    description: '管理員密碼（至少 6 個字符）',
  }),
  API_TOKEN: z.string().optional().openapi({
    example: 'your-api-token-here',
    description: '第三方 API 訪問令牌',
  }),
  TIMEZONE: z.string().optional().openapi({
    example: 'Asia/Taipei',
    description: '時區設定',
  }),
  TELEGRAM_BOT_TOKEN: z.string().optional().openapi({
    example: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    description: 'Telegram Bot Token',
  }),
  TELEGRAM_CHAT_ID: z.string().optional().openapi({
    example: '123456789',
    description: 'Telegram Chat ID',
  }),
  WEBHOOK_URL: z.string().url('Webhook URL 格式無效').optional().or(z.literal('')).openapi({
    example: 'https://example.com/webhook',
    description: 'Webhook URL（可為空）',
  }),
  WEBHOOK_METHOD: z.enum(['GET', 'POST', 'PUT', 'PATCH']).optional().openapi({
    example: 'POST',
    description: 'Webhook HTTP 方法',
  }),
  WEBHOOK_HEADERS: z.string().optional().openapi({
    example: '{"Content-Type": "application/json"}',
    description: 'Webhook Headers（JSON 格式）',
  }),
  WEBHOOK_TEMPLATE: z.string().optional().openapi({
    example: '訂閱 {{name}} 將於 {{date}} 到期',
    description: 'Webhook 消息模板',
  }),
  RESEND_API_KEY: z.string().optional().openapi({
    example: 're_123456789abcdef',
    description: 'Resend API Key（用於郵件發送）',
  }),
  EMAIL_FROM: z.string().email('發件人郵箱格式無效').optional().or(z.literal('')).openapi({
    example: 'noreply@example.com',
    description: '發件人郵箱（可為空）',
  }),
  EMAIL_FROM_NAME: z.string().optional().openapi({
    example: 'SubsTracker',
    description: '發件人名稱',
  }),
  EMAIL_TO: z.string().email('收件人郵箱格式無效').optional().or(z.literal('')).openapi({
    example: 'user@example.com',
    description: '收件人郵箱（可為空）',
  }),
  BARK_SERVER: z.string().url('Bark 服務器 URL 格式無效').optional().or(z.literal('')).openapi({
    example: 'https://api.day.app',
    description: 'Bark 服務器 URL（可為空）',
  }),
  BARK_KEY: z.string().optional().openapi({
    example: 'your-bark-device-key',
    description: 'Bark 設備 Key',
  }),
  BARK_SAVE: z.string().optional().openapi({
    example: '1',
    description: 'Bark 是否保存消息（1=是，0=否）',
  }),
  BARK_QUERY: z.string().optional().openapi({
    example: 'sound=alarm&group=訂閱提醒',
    description: 'Bark URL 查詢參數（不含 ?）',
  }),
  NOTIFICATION_HOURS: z.union([
    z.array(z.number().int().min(0).max(23)),
    z.string(),
  ]).optional().openapi({
    example: [9, 12, 18],
    description: '允許發送通知的小時（0-23），空陣列表示所有小時',
  }),
  ENABLED_NOTIFIERS: z.array(z.string()).optional().openapi({
    example: ['telegram', 'email', 'notifyx'],
    description: '啟用的通知渠道',
  }),
  REMINDER_MODE: z.enum(['ONCE', 'DAILY']).optional().openapi({
    example: 'ONCE',
    description: '提醒頻率模式：ONCE=首次觸發，DAILY=每日發送',
  }),
})

/**
 * 錯誤響應 Schema
 */
const ErrorResponseSchema = z.object({
  success: z.boolean().openapi({ example: false }),
  message: z.string().openapi({ example: '錯誤訊息' }),
  errors: z.array(z.object({
    path: z.string(),
    message: z.string(),
  })).optional(),
  code: z.string().optional().openapi({ example: 'INTERNAL_ERROR' }),
})

/**
 * 配置數據 Schema（不包含敏感信息）
 */
const ConfigDataSchema = z.object({
  ADMIN_USERNAME: z.string(),
  API_TOKEN: z.string().optional(),
  TIMEZONE: z.string(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  WEBHOOK_URL: z.string().optional(),
  WEBHOOK_METHOD: z.string().optional(),
  WEBHOOK_HEADERS: z.string().optional(),
  WEBHOOK_TEMPLATE: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_FROM_NAME: z.string().optional(),
  EMAIL_TO: z.string().optional(),
  BARK_SERVER: z.string().optional(),
  BARK_KEY: z.string().optional(),
  BARK_SAVE: z.string().optional(),
  BARK_QUERY: z.string().optional(),
  NOTIFICATION_HOURS: z.array(z.number()),
  ENABLED_NOTIFIERS: z.array(z.string()),
}).openapi({
  example: {
    ADMIN_USERNAME: 'admin',
    API_TOKEN: '',
    TIMEZONE: 'Asia/Taipei',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_CHAT_ID: '',
    WEBHOOK_URL: '',
    WEBHOOK_METHOD: 'POST',
    WEBHOOK_HEADERS: '',
    WEBHOOK_TEMPLATE: '',
    RESEND_API_KEY: '',
    EMAIL_FROM: '',
    EMAIL_FROM_NAME: '',
    EMAIL_TO: '',
    BARK_SERVER: 'https://api.day.app',
    BARK_KEY: '',
    BARK_SAVE: '1',
    BARK_QUERY: '',
    NOTIFICATION_HOURS: [],
    ENABLED_NOTIFIERS: ['notifyx'],
  },
})

/**
 * 成功響應 Schema（含配置數據）
 */
const SuccessResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  data: ConfigDataSchema.optional(),
  message: z.string().optional(),
})

/**
 * 更新成功響應 Schema（不含數據）
 */
const UpdateSuccessResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().optional().openapi({ example: '配置更新成功' }),
})

/**
 * GET /api/config 路由定義
 */
const getConfigRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Config'],
  summary: '獲取系統配置',
  description: '獲取當前系統配置（敏感信息已過濾，不包含 JWT_SECRET 和 ADMIN_PASSWORD）',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
      description: '成功獲取配置',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: '未授權訪問',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: '服務器錯誤',
    },
  },
})

/**
 * GET /api/config
 * 獲取系統配置（敏感信息已過濾）
 */
config.openapi(getConfigRoute, async (c) => {
  // 手動執行認證檢查
  const authResult = await authMiddleware(c, async () => {})
  if (authResult) {
    return c.json({
      success: false,
      message: '未授權訪問，請先登入',
      code: 'UNAUTHORIZED',
    }, 401)
  }

  try {
    const user = c.get('user')
    logger.info(`獲取配置: ${user.username}`, { prefix: 'Config' })

    const configData = await getConfig(c.env)

    // 過濾敏感信息
    const { JWT_SECRET, ADMIN_PASSWORD, ...safeConfig } = configData

    return c.json({
      success: true,
      data: safeConfig,
    }, 200)
  }
  catch (error) {
    logger.error('獲取配置失敗', error, { prefix: 'Config' })
    return c.json({
      success: false,
      message: '獲取配置失敗',
      code: 'INTERNAL_ERROR',
    }, 500)
  }
})

/**
 * PUT /api/config 路由定義
 */
const updateConfigRoute = createRoute({
  method: 'put',
  path: '/',
  tags: ['Config'],
  summary: '更新系統配置',
  description: '更新系統配置（支持部分更新），密碼會自動加密',
  request: {
    body: {
      content: {
        'application/json': {
          schema: updateConfigSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UpdateSuccessResponseSchema,
        },
      },
      description: '配置更新成功',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: '請求驗證失敗',
    },
    401: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: '未授權訪問',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: '服務器錯誤',
    },
  },
})

/**
 * PUT /api/config
 * 更新系統配置
 */
config.openapi(updateConfigRoute, async (c) => {
  // 手動執行認證檢查
  const authResult = await authMiddleware(c, async () => {})
  if (authResult) {
    return c.json({
      success: false,
      message: '未授權訪問，請先登入',
      code: 'UNAUTHORIZED',
    }, 401)
  }

  try {
    const user = c.get('user')
    const newConfig = c.req.valid('json') as Partial<Config>

    logger.info(`更新配置: ${user.username}`, { prefix: 'Config', data: Object.keys(newConfig) })

    // 類型斷言，因為 updateConfig 會在內部處理 NOTIFICATION_HOURS 的規範化
    const result = await updateConfig(newConfig, c.env)

    if (!result.success) {
      return c.json({
        success: false,
        message: result.message || '更新配置失敗',
        code: 'VALIDATION_ERROR',
      }, 400)
    }

    return c.json({
      success: true,
      message: '配置更新成功',
    }, 200)
  }
  catch (error) {
    logger.error('更新配置失敗', error, { prefix: 'Config' })
    return c.json({
      success: false,
      message: '更新配置失敗',
      code: 'INTERNAL_ERROR',
    }, 500)
  }
})

export default config
