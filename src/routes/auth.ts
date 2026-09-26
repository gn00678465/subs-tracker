import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'

import { loadSettings } from '../services/settings'
import type { HonoEnv } from '../types'
import { clearTokenCookie, generateJWT, setTokenCookie, verifyPassword } from '../utils/crypto'
import * as logger from '../utils/logger'

// 創建認證路由實例
const auth = new OpenAPIHono<HonoEnv>()

// 登入請求的 Schema
const LoginSchema = z.object({
  username: z.string().min(1, '用戶名不能為空').openapi({
    example: 'admin',
  }),
  password: z.string().min(1, '密碼不能為空').openapi({
    example: 'password',
  }),
})

// 登入響應 Schema（成功）
const LoginResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  data: z
    .object({
      username: z.string(),
    })
    .optional(),
  message: z.string().optional(),
})

// 錯誤響應 Schema
const ErrorResponseSchema = z.object({
  success: z.boolean().openapi({ example: false }),
  message: z.string(),
  errors: z
    .array(
      z.object({
        path: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
  code: z.string().optional(),
})

/**
 * POST /api/login 路由定義
 *
 * 除了 JSON，也接受表單格式。@hono/zod-openapi 對未宣告的 Content-Type 回傳 415，
 * 所以表單格式必須在 content 內宣告。
 */
const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Auth'],
  summary: '用戶登入',
  description: '使用用戶名和密碼進行身份驗證，成功後返回 JWT Token。支援 JSON 和 Form Data 格式。',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LoginSchema,
        },
        'application/x-www-form-urlencoded': {
          schema: LoginSchema,
        },
        'multipart/form-data': {
          schema: LoginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: LoginResponseSchema,
        },
      },
      description: '登入成功',
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
      description: '用戶名或密碼錯誤',
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
 * POST /api/login
 * 用戶登入
 */
auth.openapi(loginRoute, async (c) => {
  try {
    const contentType = c.req.header('Content-Type') || ''
    const isForm =
      contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')
    const { username, password } = isForm ? c.req.valid('form') : c.req.valid('json')

    const settings = await loadSettings(c.env)

    logger.info(`登入嘗試: ${username}`, { prefix: 'Auth' })
    // 驗證用戶名
    if (username !== settings.adminUsername) {
      logger.warning(`登入失敗: 用戶名錯誤 (${username})`, { prefix: 'Auth' })
      return c.json(
        {
          success: false,
          message: '用戶名或密碼錯誤',
          code: 'UNAUTHORIZED',
        },
        401,
      )
    }

    // 驗證密碼（使用 Hash 驗證）
    const passwordValid = await verifyPassword(password, settings.adminPasswordHash, settings.jwtSecret)
    if (!passwordValid) {
      logger.warning(`登入失敗: 密碼錯誤 (${username})`, { prefix: 'Auth' })
      return c.json(
        {
          success: false,
          message: '用戶名或密碼錯誤',
          code: 'UNAUTHORIZED',
        },
        401,
      )
    }

    // 生成 JWT Token
    const token = await generateJWT(username, settings.jwtSecret)

    // 設置 Cookie
    setTokenCookie(c, token)

    logger.info(`登入成功: ${username}`, { prefix: 'Auth' })

    return c.json(
      {
        success: true,
        data: { username },
        message: '登入成功',
      },
      200,
    )
  } catch (error) {
    logger.error('登入處理失敗', error, { prefix: 'Auth' })
    return c.json(
      {
        success: false,
        message: '登入處理失敗，請稍後重試',
        code: 'INTERNAL_ERROR',
      },
      500,
    )
  }
})

/**
 * GET /api/logout 路由定義
 */
const logoutRoute = createRoute({
  method: 'get',
  path: '/logout',
  tags: ['Auth'],
  summary: '用戶登出',
  description: '清除認證 Cookie 並重定向到登入頁',
  responses: {
    302: {
      description: '重定向到登入頁',
    },
  },
})

/**
 * GET /api/logout
 * 用戶登出
 */
auth.openapi(logoutRoute, (c) => {
  // 清除 Cookie
  clearTokenCookie(c)

  logger.info('用戶登出', { prefix: 'Auth' })

  // 重定向到登入頁
  return c.redirect('/')
})

export default auth
