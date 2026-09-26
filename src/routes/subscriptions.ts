import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import { authMiddleware } from '../middleware/auth'
import { loadSettings } from '../services/config'
import type { SubscriptionInput } from '../services/subscription'
import {
  createSubscription,
  deleteSubscription,
  findSubscription,
  listSubscriptions,
  renewSubscription,
  updateSubscription,
} from '../services/subscription'
import type { HonoEnv } from '../types'
import { isCalendarDate, todayIn } from '../utils/calendarDate'
import * as logger from '../utils/logger'
import { created, notFound, serverError, success } from '../utils/response'

const subscriptions = new OpenAPIHono<HonoEnv>()

subscriptions.use('*', authMiddleware)

const idParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .openapi({ param: { name: 'id', in: 'path' }, example: '0b9f6c1e-3d2a-4c1b-9a51-6f2e8d7c4b10' }),
})

const calendarDate = z.string().refine(isCalendarDate, { message: '日期格式必須是 YYYY-MM-DD' })

const reminderSchema = z
  .union([z.literal('default'), z.literal('off'), z.number().int().min(1).max(365)])
  .openapi({ description: "'default' 沿用預設提前天數；'off' 不提醒；數字是提前天數", example: 'default' })

// 沒有預設值：更新時缺少的欄位代表不變，不能被預設值覆蓋
const inputFields = {
  name: z.string().trim().min(1, '名稱不能為空'),
  category: z.string().trim().max(40),
  currency: z.string().regex(/^[A-Z]{3}$/, '貨幣必須是 3 個大寫字母，例如 TWD'),
  price: z.number().finite().nonnegative(),
  periodValue: z.number().int().min(1).max(999),
  periodUnit: z.enum(['day', 'week', 'month', 'year']),
  expiryDate: calendarDate,
  autoRenew: z.boolean(),
  isFreeTrial: z.boolean(),
  reminder: reminderSchema,
  paymentMethod: z.string().trim().max(40),
  website: z.string().trim().max(2048),
  notes: z.string().max(4000),
  isActive: z.boolean(),
}

// 選填日期：null 代表清除
const optionalDates = {
  cancelByDate: calendarDate.nullable().optional(),
  startDate: calendarDate.nullable().optional(),
}

const createSchema = z.object({
  ...inputFields,
  category: inputFields.category.optional(),
  isFreeTrial: inputFields.isFreeTrial.optional(),
  reminder: reminderSchema.optional(),
  paymentMethod: inputFields.paymentMethod.optional(),
  website: inputFields.website.optional(),
  notes: inputFields.notes.optional(),
  isActive: inputFields.isActive.optional(),
  ...optionalDates,
})

const updateSchema = z.object(inputFields).partial().extend(optionalDates)

const SubscriptionSchema = z
  .object({
    ...inputFields,
    id: z.string(),
    cancelByDate: calendarDate.optional(),
    startDate: calendarDate.optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    lastReminderSentAt: z.string().optional(),
    lastCheckedExpiryDate: calendarDate.optional(),
  })
  .openapi('Subscription')

const ErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  code: z.string().optional(),
})

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
})

const dataResponse = <T extends z.ZodType>(data: T, description: string) =>
  json(z.object({ success: z.literal(true), data, message: z.string().optional() }), description)

const errorResponses = {
  400: json(ErrorResponseSchema, '請求驗證失敗'),
  500: json(ErrorResponseSchema, '伺服器錯誤'),
}

const notFoundResponse = { 404: json(ErrorResponseSchema, '訂閱不存在') }

// null 轉成 undefined，只保留請求中有的欄位
function toPatch(data: z.infer<typeof updateSchema>): Partial<SubscriptionInput> {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value ?? undefined]),
  )
}

subscriptions.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Subscriptions'],
    summary: '列出訂閱',
    responses: { 200: dataResponse(z.array(SubscriptionSchema), '訂閱列表'), ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      return success(c, await listSubscriptions(c.env.DB))
    } catch (error) {
      logger.error('列出訂閱失敗', error, { prefix: 'Subscriptions' })
      return serverError(c, '讀取訂閱失敗')
    }
  },
)

subscriptions.openapi(
  createRoute({
    method: 'post',
    path: '/',
    tags: ['Subscriptions'],
    summary: '新增訂閱',
    request: { body: { content: { 'application/json': { schema: createSchema } } } },
    responses: { 201: dataResponse(SubscriptionSchema, '已新增'), ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      const data = c.req.valid('json')
      const subscription = await createSubscription(
        {
          ...data,
          category: data.category ?? '',
          isFreeTrial: data.isFreeTrial ?? false,
          reminder: data.reminder ?? 'default',
          paymentMethod: data.paymentMethod ?? '',
          website: data.website ?? '',
          notes: data.notes ?? '',
          isActive: data.isActive ?? true,
          cancelByDate: data.cancelByDate ?? undefined,
          startDate: data.startDate ?? undefined,
        },
        c.env,
      )
      return created(c, subscription, '已新增')
    } catch (error) {
      logger.error('新增訂閱失敗', error, { prefix: 'Subscriptions' })
      return serverError(c, '新增訂閱失敗')
    }
  },
)

subscriptions.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    tags: ['Subscriptions'],
    summary: '讀取一筆訂閱',
    request: { params: idParamSchema },
    responses: { 200: dataResponse(SubscriptionSchema, '訂閱'), ...notFoundResponse, ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      const subscription = await findSubscription(c.env.DB, c.req.valid('param').id)
      return subscription ? success(c, subscription) : notFound(c, '訂閱不存在')
    } catch (error) {
      logger.error('讀取訂閱失敗', error, { prefix: 'Subscriptions' })
      return serverError(c, '讀取訂閱失敗')
    }
  },
)

subscriptions.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    tags: ['Subscriptions'],
    summary: '修改訂閱',
    description: '只修改請求中有的欄位。停用與啟用也用這個路由（`isActive`）。',
    request: { params: idParamSchema, body: { content: { 'application/json': { schema: updateSchema } } } },
    responses: { 200: dataResponse(SubscriptionSchema, '已儲存'), ...notFoundResponse, ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      const settings = await loadSettings(c.env)
      const subscription = await updateSubscription(
        c.req.valid('param').id,
        toPatch(c.req.valid('json')),
        todayIn(settings.timezone),
        c.env,
      )
      return subscription ? success(c, subscription, '已儲存') : notFound(c, '訂閱不存在')
    } catch (error) {
      logger.error('修改訂閱失敗', error, { prefix: 'Subscriptions' })
      return serverError(c, '修改訂閱失敗')
    }
  },
)

subscriptions.openapi(
  createRoute({
    method: 'post',
    path: '/{id}/renew',
    tags: ['Subscriptions'],
    summary: '已續訂',
    description: '下次扣款日推進一個付款週期；試用轉為付費，取消期限清除。',
    request: { params: idParamSchema },
    responses: { 200: dataResponse(SubscriptionSchema, '已續訂'), ...notFoundResponse, ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      const subscription = await renewSubscription(c.req.valid('param').id, c.env)
      return subscription ? success(c, subscription, '已續訂') : notFound(c, '訂閱不存在')
    } catch (error) {
      logger.error('續訂失敗', error, { prefix: 'Subscriptions' })
      return serverError(c, '續訂失敗')
    }
  },
)

subscriptions.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    tags: ['Subscriptions'],
    summary: '刪除訂閱',
    request: { params: idParamSchema },
    responses: {
      200: json(z.object({ success: z.literal(true), message: z.string() }), '已刪除'),
      ...notFoundResponse,
      ...errorResponses,
    },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      const deleted = await deleteSubscription(c.req.valid('param').id, c.env)
      return deleted ? success(c, undefined, '已刪除') : notFound(c, '訂閱不存在')
    } catch (error) {
      logger.error('刪除訂閱失敗', error, { prefix: 'Subscriptions' })
      return serverError(c, '刪除訂閱失敗')
    }
  },
)

export default subscriptions
