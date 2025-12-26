import type { HonoEnv } from '../types'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { authMiddleware } from '../middleware/auth'
import { getConfig } from '../services/config'
import { sendNotificationToAllChannels } from '../services/notifier'
import {
  createSubscription,
  deleteSubscription,
  getAllSubscriptions,
  getSubscription,
  toggleSubscriptionStatus,
  updateSubscription,
} from '../services/subscription'
import * as logger from '../utils/logger'
import { created, notFound, serverError, success, validationError } from '../utils/response'

// 創建訂閱路由實例
const subscriptions = new OpenAPIHono<HonoEnv>()

// 所有訂閱路由都需要認證
subscriptions.use('*', authMiddleware)

// ID 路徑參數驗證 Schema
const idParamSchema = z.object({
  id: z.string()
    .regex(/^\d+$/, 'ID 必須為數字字串')
    .refine(
      (id) => {
        const timestamp = Number.parseInt(id, 10)
        // 驗證範圍：2020-01-01 到 2100-01-01
        return timestamp >= 1577836800000 && timestamp <= 4102444800000
      },
      { message: 'ID 格式無效' },
    )
    .openapi({
      param: {
        name: 'id',
        in: 'path',
      },
      example: '1703123456789',
      description: '訂閱 ID（時間戳格式）',
    }),
})

// 訂閱數據驗證 Schema
const subscriptionSchema = z.object({
  name: z.string().min(1, '訂閱名稱不能為空'),
  customType: z.string().optional(),
  category: z.string().optional(),
  currency: z.string().optional(),
  price: z.string().optional(),
  startDate: z.string().optional(),
  expiryDate: z.string().refine(
    (date) => {
      const parsed = new Date(date)
      return !Number.isNaN(parsed.getTime())
    },
    { message: '無效的日期格式' },
  ),
  hasEndDate: z.boolean().optional(),
  autoRenew: z.boolean().default(false),
  isFreeTrial: z.boolean().optional(),
  periodValue: z.number().int().positive().optional(),
  periodUnit: z.enum(['day', 'month', 'year']).optional(),
  periodMethod: z.enum(['credit', 'apple', 'google', 'paypal', 'other']).optional(),
  website: z.string().optional(),
  isReminderSet: z.boolean().optional(),
  reminderMe: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
})

// 更新訂閱的部分字段
const updateSubscriptionSchema = subscriptionSchema.partial()

// 切換狀態的 Schema
const toggleStatusSchema = z.object({
  isActive: z.boolean(),
})

// 訂閱響應 Schema
const SubscriptionResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  expiryDate: z.string(),
  autoRenew: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  customType: z.string().optional(),
  category: z.string().optional(),
  currency: z.string().optional(),
  price: z.string().optional(),
  startDate: z.string().optional(),
  hasEndDate: z.boolean().optional(),
  isFreeTrial: z.boolean().optional(),
  periodValue: z.number().optional(),
  periodUnit: z.enum(['day', 'month', 'year']).optional(),
  periodMethod: z.enum(['credit', 'apple', 'google', 'paypal', 'other']).optional(),
  website: z.string().optional(),
  isReminderSet: z.boolean().optional(),
  reminderMe: z.number().optional(),
  notes: z.string().optional(),
  lastReminderSentAt: z.string().optional(),
  lastCheckedExpiryDate: z.string().optional(),
}).openapi('Subscription')

// 成功響應 Schema
const SuccessResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  data: z.unknown().optional(),
  message: z.string().optional(),
})

// 錯誤響應 Schema
const ErrorResponseSchema = z.object({
  success: z.boolean().openapi({ example: false }),
  message: z.string(),
  errors: z.array(z.object({
    path: z.string(),
    message: z.string(),
  })).optional(),
  code: z.string().optional(),
})

/**
 * GET /api/subscriptions 路由定義
 */
const listSubscriptionsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Subscriptions'],
  summary: '獲取訂閱列表',
  description: '獲取所有訂閱列表',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: z.array(SubscriptionResponseSchema),
          }),
        },
      },
      description: '成功獲取訂閱列表',
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
 * GET /api/subscriptions
 * 獲取所有訂閱列表
 */
// @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
subscriptions.openapi(listSubscriptionsRoute, async (c) => {
  try {
    const user = c.get('user')
    logger.info(`獲取訂閱列表: ${user.username}`, { prefix: 'Subscriptions' })

    const subscriptions = await getAllSubscriptions(c.env)

    return success(c, subscriptions)
  }
  catch (error) {
    logger.error('獲取訂閱列表失敗', error, { prefix: 'Subscriptions' })
    return serverError(c, '獲取訂閱列表失敗')
  }
})

/**
 * POST /api/subscriptions 路由定義
 */
const createSubscriptionRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Subscriptions'],
  summary: '創建訂閱',
  description: '創建新訂閱',
  request: {
    body: {
      content: {
        'application/json': {
          schema: subscriptionSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: SubscriptionResponseSchema,
          }),
        },
      },
      description: '訂閱創建成功',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: '請求驗證失敗',
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
 * POST /api/subscriptions
 * 創建新訂閱
 */
// @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
subscriptions.openapi(createSubscriptionRoute, async (c) => {
  try {
    const user = c.get('user')
    const data = c.req.valid('json')

    logger.info(`創建訂閱: ${data.name} (${user.username})`, { prefix: 'Subscriptions' })

    const result = await createSubscription(data, c.env)

    if (!result.success) {
      return validationError(c, result.message || '創建訂閱失敗')
    }

    return created(c, result.subscription, '訂閱創建成功')
  }
  catch (error) {
    logger.error('創建訂閱失敗', error, { prefix: 'Subscriptions' })
    return serverError(c, '創建訂閱失敗')
  }
})

/**
 * GET /api/subscriptions/:id 路由定義
 */
const getSubscriptionRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Subscriptions'],
  summary: '獲取訂閱詳情',
  description: '根據 ID 獲取單個訂閱的詳細信息',
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: SubscriptionResponseSchema,
          }),
        },
      },
      description: '成功獲取訂閱詳情',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: '訂閱不存在',
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
 * GET /api/subscriptions/:id
 * 獲取單個訂閱詳情
 */
// @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
subscriptions.openapi(getSubscriptionRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const user = c.get('user')

    logger.info(`獲取訂閱詳情: ${id} (${user.username})`, { prefix: 'Subscriptions' })

    const subscription = await getSubscription(id, c.env)

    if (!subscription) {
      return notFound(c, '訂閱不存在')
    }

    return success(c, subscription)
  }
  catch (error) {
    logger.error('獲取訂閱詳情失敗', error, { prefix: 'Subscriptions' })
    return serverError(c, '獲取訂閱詳情失敗')
  }
})

/**
 * PUT /api/subscriptions/:id 路由定義
 */
const updateSubscriptionRoute = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Subscriptions'],
  summary: '更新訂閱',
  description: '更新指定訂閱的信息',
  request: {
    params: idParamSchema,
    body: {
      content: {
        'application/json': {
          schema: updateSubscriptionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: SubscriptionResponseSchema,
          }),
        },
      },
      description: '訂閱更新成功',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: '請求驗證失敗',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: '訂閱不存在',
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
 * PUT /api/subscriptions/:id
 * 更新訂閱
 */
// @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
subscriptions.openapi(updateSubscriptionRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const user = c.get('user')
    const data = c.req.valid('json')

    logger.info(`更新訂閱: ${id} (${user.username})`, { prefix: 'Subscriptions' })

    const result = await updateSubscription(id, data, c.env)

    if (!result.success) {
      // 判斷是否為 "訂閱不存在" 錯誤
      if (result.message === '訂閱不存在') {
        return notFound(c, result.message)
      }
      return validationError(c, result.message || '更新訂閱失敗')
    }

    return success(c, result.subscription, '訂閱更新成功')
  }
  catch (error) {
    logger.error('更新訂閱失敗', error, { prefix: 'Subscriptions' })
    return serverError(c, '更新訂閱失敗')
  }
})

/**
 * DELETE /api/subscriptions/:id 路由定義
 */
const deleteSubscriptionRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Subscriptions'],
  summary: '刪除訂閱',
  description: '刪除指定的訂閱',
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema,
        },
      },
      description: '訂閱刪除成功',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: '訂閱不存在',
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
 * DELETE /api/subscriptions/:id
 * 刪除訂閱
 */
// @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
subscriptions.openapi(deleteSubscriptionRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const user = c.get('user')

    logger.info(`刪除訂閱: ${id} (${user.username})`, { prefix: 'Subscriptions' })

    const result = await deleteSubscription(id, c.env)

    if (!result.success) {
      if (result.message === '訂閱不存在') {
        return notFound(c, result.message)
      }
      return validationError(c, result.message || '刪除訂閱失敗')
    }

    return success(c, undefined, '訂閱刪除成功')
  }
  catch (error) {
    logger.error('刪除訂閱失敗', error, { prefix: 'Subscriptions' })
    return serverError(c, '刪除訂閱失敗')
  }
})

/**
 * PUT /api/subscriptions/:id/toggle 路由定義
 */
const toggleSubscriptionRoute = createRoute({
  method: 'put',
  path: '/{id}/toggle',
  tags: ['Subscriptions'],
  summary: '切換訂閱狀態',
  description: '切換訂閱的啟用/停用狀態',
  request: {
    params: idParamSchema,
    body: {
      content: {
        'application/json': {
          schema: toggleStatusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: SubscriptionResponseSchema,
          }),
        },
      },
      description: '狀態切換成功',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: '請求驗證失敗',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: '訂閱不存在',
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
 * PUT /api/subscriptions/:id/toggle
 * 切換訂閱啟用/停用狀態
 */
// @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
subscriptions.openapi(toggleSubscriptionRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const user = c.get('user')
    const { isActive } = c.req.valid('json')

    logger.info(`切換訂閱狀態: ${id} -> ${isActive ? '啟用' : '停用'} (${user.username})`, { prefix: 'Subscriptions' })

    const result = await toggleSubscriptionStatus(id, isActive, c.env)

    if (!result.success) {
      if (result.message === '訂閱不存在') {
        return notFound(c, result.message)
      }
      return validationError(c, result.message || '切換狀態失敗')
    }

    return success(c, result.subscription, `訂閱已${isActive ? '啟用' : '停用'}`)
  }
  catch (error) {
    logger.error('切換訂閱狀態失敗', error, { prefix: 'Subscriptions' })
    return serverError(c, '切換訂閱狀態失敗')
  }
})

/**
 * POST /api/subscriptions/:id/test 路由定義
 */
const testNotificationRoute = createRoute({
  method: 'post',
  path: '/{id}/test',
  tags: ['Subscriptions'],
  summary: '測試通知',
  description: '測試指定訂閱的通知發送',
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              totalChannels: z.number(),
              successCount: z.number(),
              failureCount: z.number(),
              details: z.array(z.unknown()),
            }),
          }),
        },
      },
      description: '測試通知發送完成',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: '沒有啟用任何通知渠道',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: '訂閱不存在',
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
 * POST /api/subscriptions/:id/test
 * 測試單個訂閱的通知
 */
// @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
subscriptions.openapi(testNotificationRoute, async (c) => {
  try {
    const { id } = c.req.valid('param')
    const user = c.get('user')

    logger.info(`測試訂閱通知: ${id} (${user.username})`, { prefix: 'Subscriptions' })

    // 獲取訂閱
    const subscription = await getSubscription(id, c.env)
    if (!subscription) {
      return notFound(c, '訂閱不存在')
    }

    // 獲取配置
    const config = await getConfig(c.env)

    // 構造測試通知
    const title = `測試通知: ${subscription.name}`
    const content = `這是一條測試通知\n\n訂閱名稱: ${subscription.name}\n到期日期: ${subscription.expiryDate}\n\n如果您收到此通知，說明通知渠道配置正確。`

    // 發送通知
    const result = await sendNotificationToAllChannels(
      {
        title,
        content,
        timestamp: new Date().toISOString(),
        metadata: { subscriptionId: id, isTest: true },
      },
      config,
    )

    logger.info(`測試通知發送完成: 成功 ${result.successCount}/${result.totalChannels}`, {
      prefix: 'Subscriptions',
      data: result,
    })

    // 返回詳細結果
    if (result.totalChannels === 0) {
      return validationError(c, '沒有啟用任何通知渠道，請先在配置頁面啟用並配置通知渠道')
    }

    if (result.successCount === 0) {
      const errorDetails = result.results.map(r => `${r.channel}: ${r.error}`).join('; ')
      return serverError(c, `所有通知渠道發送失敗，詳情: ${errorDetails}`)
    }

    return success(c, {
      totalChannels: result.totalChannels,
      successCount: result.successCount,
      failureCount: result.failureCount,
      details: result.results,
    }, `測試通知發送完成 (成功 ${result.successCount}/${result.totalChannels})`)
  }
  catch (error) {
    logger.error('測試訂閱通知失敗', error, { prefix: 'Subscriptions' })
    return serverError(c, '測試訂閱通知失敗')
  }
})

export default subscriptions
