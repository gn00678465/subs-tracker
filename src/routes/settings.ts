import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import { CHANNEL_FIELDS, CHANNELS } from '../db/settings'
import { authMiddleware } from '../middleware/auth'
import {
  exportData,
  readSettingsView,
  saveAccount,
  saveChannel,
  saveReminderSettings,
  SettingsError,
  testChannel,
} from '../services/settings'
import type { HonoEnv } from '../types'
import { isTimeZone, todayIn } from '../utils/calendarDate'
import * as logger from '../utils/logger'
import { serverError, success, validationError } from '../utils/response'

const settings = new OpenAPIHono<HonoEnv>()

settings.use('*', authMiddleware)

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

const body = <T extends z.ZodType>(schema: T) => ({ body: { content: { 'application/json': { schema } } } })

const okResponse = <T extends z.ZodType>(data: T, description: string) =>
  json(z.object({ success: z.literal(true), data, message: z.string().optional() }), description)

const errorResponses = {
  400: json(ErrorResponseSchema, '請求驗證失敗'),
  500: json(ErrorResponseSchema, '伺服器錯誤'),
}

const channelParam = z.object({
  channel: z.enum(CHANNELS).openapi({ param: { name: 'channel', in: 'path' }, example: 'telegram' }),
})

const reminderSchema = z.object({
  timezone: z.string().refine(isTimeZone, { message: '無效的時區，例如 Asia/Taipei' }),
  reminderHour: z.number().int().min(0).max(23),
  reminderMode: z.enum(['ONCE', 'DAILY']),
  defaultReminderDays: z.number().int().min(1).max(365),
})

// 所有管道欄位都是字串；空字串代表清除。必填欄位由各管道的驗證函式檢查
const channelConfigSchema = z
  .object(
    Object.fromEntries(
      [...new Set(Object.values(CHANNEL_FIELDS).flat())].map((field) => [field, z.string().max(4000).optional()]),
    ),
  )
  .openapi({ example: { TELEGRAM_BOT_TOKEN: '123456:ABC-DEF', TELEGRAM_CHAT_ID: '123456789' } })

const channelSchema = z.object({
  channel: z.enum(CHANNELS),
  enabled: z.boolean(),
  config: z.record(z.string(), z.string()),
  missingFields: z.array(z.string()),
  lastStatus: z.enum(['ok', 'failed']).nullable(),
  lastError: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
})

const settingsViewSchema = z
  .object({
    reminder: reminderSchema,
    account: z.object({ username: z.string() }),
    channels: z.array(channelSchema),
    lastRun: z
      .object({
        localDate: z.string(),
        startedAt: z.string(),
        finishedAt: z.string().nullable(),
        reminded: z.number(),
        failed: z.number(),
        error: z.string().nullable(),
      })
      .nullable(),
  })
  .openapi('Settings')

function handleError(c: Parameters<typeof validationError>[0], error: unknown, action: string): Response {
  if (error instanceof SettingsError) return validationError(c, error.message)
  logger.error(`${action}失敗`, error, { prefix: 'Settings' })
  return serverError(c, `${action}失敗`)
}

settings.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Settings'],
    summary: '讀取設定',
    description: '提醒設定、帳號、各通知管道的設定與最近一次發送結果、最近一次排程。不含密碼雜湊與 JWT 金鑰。',
    responses: { 200: okResponse(settingsViewSchema, '設定'), ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      return success(c, await readSettingsView(c.env))
    } catch (error) {
      return handleError(c, error, '讀取設定')
    }
  },
)

settings.openapi(
  createRoute({
    method: 'put',
    path: '/reminder',
    tags: ['Settings'],
    summary: '儲存提醒設定',
    request: body(reminderSchema.partial()),
    responses: { 200: json(z.object({ success: z.literal(true), message: z.string() }), '已儲存'), ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      await saveReminderSettings(c.env, c.req.valid('json'))
      return success(c, undefined, '已儲存')
    } catch (error) {
      return handleError(c, error, '儲存提醒設定')
    }
  },
)

settings.openapi(
  createRoute({
    method: 'put',
    path: '/account',
    tags: ['Settings'],
    summary: '修改使用者名稱或密碼',
    request: body(
      z.object({
        username: z.string().trim().min(1, '使用者名稱不能為空').max(64).optional(),
        password: z.string().min(8, '密碼至少 8 個字元').max(256).optional(),
      }),
    ),
    responses: { 200: json(z.object({ success: z.literal(true), message: z.string() }), '已儲存'), ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      await saveAccount(c.env, c.req.valid('json'))
      return success(c, undefined, '已儲存')
    } catch (error) {
      return handleError(c, error, '儲存帳號')
    }
  },
)

settings.openapi(
  createRoute({
    method: 'put',
    path: '/channels/{channel}',
    tags: ['Settings'],
    summary: '儲存通知管道',
    description: '啟用時，這個管道的必填欄位都要有值。',
    request: { params: channelParam, ...body(z.object({ enabled: z.boolean(), config: channelConfigSchema })) },
    responses: { 200: okResponse(channelSchema, '已儲存'), ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      const { enabled, config } = c.req.valid('json')
      return success(c, await saveChannel(c.env, c.req.valid('param').channel, enabled, config), '已儲存')
    } catch (error) {
      return handleError(c, error, '儲存通知管道')
    }
  },
)

settings.openapi(
  createRoute({
    method: 'post',
    path: '/channels/{channel}/test',
    tags: ['Settings'],
    summary: '傳送測試通知',
    description: '使用請求中尚未儲存的值發送。結果不寫入管道的最近發送結果。',
    request: { params: channelParam, ...body(z.object({ config: channelConfigSchema })) },
    responses: {
      200: okResponse(z.object({ success: z.boolean(), error: z.string().optional() }), '發送結果'),
      ...errorResponses,
    },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      const result = await testChannel(c.req.valid('param').channel, c.req.valid('json').config)
      return success(
        c,
        { success: result.success, error: result.error },
        result.success ? '已送出' : `發送失敗：${result.error}`,
      )
    } catch (error) {
      return handleError(c, error, '傳送測試通知')
    }
  },
)

settings.openapi(
  createRoute({
    method: 'get',
    path: '/export',
    tags: ['Settings'],
    summary: '匯出 JSON',
    description: '所有訂閱與設定。不含密碼雜湊、JWT 金鑰、passkey 與通知管道的憑證。',
    responses: { 200: json(z.object({}).passthrough(), '匯出檔'), ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      const now = new Date()
      const data = await exportData(c.env, now)
      c.header(
        'Content-Disposition',
        `attachment; filename="subs-tracker-${todayIn(data.settings.timezone, now)}.json"`,
      )
      return c.json(data)
    } catch (error) {
      return handleError(c, error, '匯出')
    }
  },
)

export default settings
