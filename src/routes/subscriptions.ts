import type { HonoEnv } from '../types'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
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
const subscriptions = new Hono<HonoEnv>()

// 所有訂閱路由都需要認證
subscriptions.use('*', authMiddleware)

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

/**
 * GET /api/subscriptions
 * 獲取所有訂閱列表
 */
subscriptions.get('/', async (c) => {
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
 * POST /api/subscriptions
 * 創建新訂閱
 */
subscriptions.post('/', zValidator('json', subscriptionSchema, (result, c) => {
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    return validationError(c, '訂閱數據驗證失敗', errors)
  }
}), async (c) => {
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
 * GET /api/subscriptions/:id
 * 獲取單個訂閱詳情
 */
subscriptions.get('/:id', async (c) => {
  try {
    const id = c.req.param('id')
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
 * PUT /api/subscriptions/:id
 * 更新訂閱
 */
subscriptions.put('/:id', zValidator('json', updateSubscriptionSchema, (result, c) => {
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    return validationError(c, '訂閱數據驗證失敗', errors)
  }
}), async (c) => {
  try {
    const id = c.req.param('id')
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
 * DELETE /api/subscriptions/:id
 * 刪除訂閱
 */
subscriptions.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
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
 * PUT /api/subscriptions/:id/toggle
 * 切換訂閱啟用/停用狀態
 */
subscriptions.put('/:id/toggle', zValidator('json', toggleStatusSchema, (result, c) => {
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    return validationError(c, '請求數據驗證失敗', errors)
  }
}), async (c) => {
  try {
    const id = c.req.param('id')
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
 * POST /api/subscriptions/:id/test
 * 測試單個訂閱的通知
 */
subscriptions.post('/:id/test', async (c) => {
  try {
    const id = c.req.param('id')
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
