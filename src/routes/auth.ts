import type { HonoEnv } from '../types'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { getConfig } from '../services/config'
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
  data: z.object({
    username: z.string(),
  }).optional(),
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
 * POST /api/login 路由定義
 */
const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Auth'],
  summary: '用戶登入',
  description: '使用用戶名和密碼進行身份驗證，成功後返回 JWT Token',
  request: {
    body: {
      content: {
        'application/json': {
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
    const { username, password } = c.req.valid('json')
    const config = await getConfig(c.env)

    logger.info(`登入嘗試: ${username}`, { prefix: 'Auth' })

    // 驗證用戶名
    if (username !== config.ADMIN_USERNAME) {
      logger.warning(`登入失敗: 用戶名錯誤 (${username})`, { prefix: 'Auth' })
      return c.json({
        success: false,
        message: '用戶名或密碼錯誤',
        code: 'UNAUTHORIZED',
      }, 401)
    }

    // 驗證密碼（使用 Hash 驗證）
    const passwordValid = await verifyPassword(password, config.ADMIN_PASSWORD, config.JWT_SECRET)
    if (!passwordValid) {
      logger.warning(`登入失敗: 密碼錯誤 (${username})`, { prefix: 'Auth' })
      return c.json({
        success: false,
        message: '用戶名或密碼錯誤',
        code: 'UNAUTHORIZED',
      }, 401)
    }

    // 生成 JWT Token
    const token = await generateJWT(username, config.JWT_SECRET)

    // 設置 Cookie
    setTokenCookie(c, token)

    logger.info(`登入成功: ${username}`, { prefix: 'Auth' })

    return c.json({
      success: true,
      data: { username },
      message: '登入成功',
    }, 200)
  }
  catch (error) {
    logger.error('登入處理失敗', error, { prefix: 'Auth' })
    return c.json({
      success: false,
      message: '登入處理失敗，請稍後重試',
      code: 'INTERNAL_ERROR',
    }, 500)
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
