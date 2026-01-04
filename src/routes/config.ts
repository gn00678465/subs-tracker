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

  // WebAuthn 配置
  WEBAUTHN_ENABLED: z.boolean().optional().openapi({
    example: false,
    description: '是否啟用 WebAuthn 認證',
  }),
  WEBAUTHN_RP_NAME: z.string().optional().openapi({
    example: 'SubsTracker',
    description: 'Relying Party 名稱（顯示給使用者）',
  }),
  WEBAUTHN_RP_ID: z.string().optional().openapi({
    example: 'example.com',
    description: 'Relying Party ID（主網域）',
  }),
  WEBAUTHN_RP_ORIGINS: z.union([
    z.array(z.string().url('Origin URL 格式無效')),
    z.string(),
  ]).optional().openapi({
    example: ['https://example.com', 'https://app.example.com'],
    description: '允許的來源 Origins（支援 Related Origin Requests）',
  }),
  WEBAUTHN_ATTESTATION: z.enum(['none', 'direct', 'enterprise']).optional().openapi({
    example: 'none',
    description: '認證類型（none=不驗證, direct=直接驗證, enterprise=企業驗證）',
  }),
  WEBAUTHN_AUTHENTICATOR_ATTACHMENT: z.enum(['platform', 'cross-platform']).optional().openapi({
    example: 'platform',
    description: '驗證器類型偏好（platform=內建如 Touch ID, cross-platform=外部如 USB 金鑰，未設定表示不限制）',
  }),
  WEBAUTHN_RESIDENT_KEY: z.enum(['required', 'preferred', 'discouraged']).optional().openapi({
    example: 'preferred',
    description: '駐留金鑰要求（required=必須, preferred=優先, discouraged=不建議）',
  }),
  WEBAUTHN_USER_VERIFICATION: z.enum(['required', 'preferred', 'discouraged']).optional().openapi({
    example: 'preferred',
    description: '使用者驗證要求（required=必須生物識別, preferred=優先, discouraged=不建議）',
  }),
  WEBAUTHN_TIMEOUT: z.number().int().min(10000, 'Timeout 不得小於 10 秒').max(600000, 'Timeout 不得大於 10 分鐘').optional().openapi({
    example: 60000,
    description: '認證超時時間（毫秒，範圍：10000-600000）',
  }),
  WEBAUTHN_HINTS: z.array(z.enum(['security-key', 'client-device', 'hybrid'])).optional().openapi({
    example: ['security-key', 'client-device'],
    description: 'WebAuthn 提示（引導使用者選擇驗證器類型）',
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
  REMINDER_MODE: z.string().optional(),

  // WebAuthn 配置
  WEBAUTHN_ENABLED: z.boolean().optional(),
  WEBAUTHN_RP_NAME: z.string().optional(),
  WEBAUTHN_RP_ID: z.string().optional(),
  WEBAUTHN_RP_ORIGINS: z.array(z.string()).optional(),
  WEBAUTHN_ATTESTATION: z.string().optional(),
  WEBAUTHN_AUTHENTICATOR_ATTACHMENT: z.string().optional(),
  WEBAUTHN_RESIDENT_KEY: z.string().optional(),
  WEBAUTHN_USER_VERIFICATION: z.string().optional(),
  WEBAUTHN_TIMEOUT: z.number().optional(),
  WEBAUTHN_HINTS: z.array(z.string()).optional(),
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
    REMINDER_MODE: 'ONCE',
    WEBAUTHN_ENABLED: false,
    WEBAUTHN_RP_NAME: 'SubsTracker',
    WEBAUTHN_RP_ID: '',
    WEBAUTHN_RP_ORIGINS: [],
    WEBAUTHN_ATTESTATION: 'none',
    WEBAUTHN_AUTHENTICATOR_ATTACHMENT: undefined,
    WEBAUTHN_RESIDENT_KEY: 'preferred',
    WEBAUTHN_USER_VERIFICATION: 'preferred',
    WEBAUTHN_TIMEOUT: 60000,
    WEBAUTHN_HINTS: [],
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
