import type { Context, Next } from 'hono'

import { loadSettings } from '../services/settings'
import type { HonoEnv } from '../types'
import { ErrorCode } from '../types/error'
import { clearTokenCookie, extractToken, verifyJWT } from '../utils/crypto'
import * as logger from '../utils/logger'

/**
 * JWT 認證中間件
 * 驗證請求中的 JWT Token，並將用戶信息存入 context
 */
export async function authMiddleware(c: Context<HonoEnv>, next: Next): Promise<Response | void> {
  try {
    // 提取 Token（優先級：Cookie > Authorization Header）
    const token = extractToken(c)

    if (!token) {
      logger.warning('未提供認證 Token', { prefix: 'Auth' })
      return c.json(
        {
          success: false,
          message: '未授權訪問，請先登入',
        },
        401,
      )
    }

    const { jwtSecret } = await loadSettings(c.env)

    // 驗證 Token
    const payload = await verifyJWT(token, jwtSecret)

    if (!payload) {
      logger.warning('Token 驗證失敗', { prefix: 'Auth' })
      return c.json(
        {
          success: false,
          message: '認證無效或已過期，請重新登入',
        },
        401,
      )
    }

    // 將用戶信息存入 context
    c.set('user', payload)

    logger.jwt(`用戶已認證: ${payload.username}`)

    // 繼續處理請求
    await next()
  } catch (error) {
    logger.error('認證中間件執行失敗', error, { prefix: 'Auth' })
    return c.json(
      {
        success: false,
        message: '認證處理失敗',
      },
      500,
    )
  }
}

export const REAUTH_WINDOW_SECONDS = 10 * 60

/**
 * 新增或刪除 passkey、修改帳號前，要在 10 分鐘內登入過。
 * 沒有換發 JWT 的機制，iat 就是最後一次輸入密碼或完成 passkey 驗證的時間；
 * 重新驗證的方式是再登入一次（POST /api/login 或 passkey 登入）。
 * 放在 authMiddleware 之後。
 */
export async function recentAuthMiddleware(c: Context<HonoEnv>, next: Next): Promise<Response | void> {
  const { iat } = c.get('user')
  if (Math.floor(Date.now() / 1000) - iat > REAUTH_WINDOW_SECONDS) {
    return c.json({ success: false, message: '請再次驗證身分', code: ErrorCode.REAUTH_REQUIRED }, 403)
  }
  await next()
}

/**
 * 可選的認證中間件
 * 如果有 Token 則驗證，沒有 Token 則繼續處理（不阻斷請求）
 */
export async function optionalAuthMiddleware(c: Context<HonoEnv>, next: Next): Promise<void> {
  try {
    const token = extractToken(c)

    if (token) {
      const { jwtSecret } = await loadSettings(c.env)
      const payload = await verifyJWT(token, jwtSecret)

      if (payload) {
        c.set('user', payload)
        logger.jwt(`可選認證成功: ${payload.username}`)
      }
    }

    await next()
  } catch (error) {
    logger.error('可選認證中間件執行失敗', error, { prefix: 'Auth' })
    // 即使出錯也繼續處理請求
    await next()
  }
}

/**
 * 頁面認證中間件
 * 認證失敗時重定向到登入頁，而非返回 JSON
 * 用於頁面路由（/admin、/admin/config 等）
 */
export async function pageAuthMiddleware(c: Context<HonoEnv>, next: Next): Promise<Response | void> {
  try {
    const token = extractToken(c)

    if (!token) {
      logger.warning('頁面訪問未授權，重定向到登入頁', { prefix: 'Auth' })
      return c.redirect('/')
    }

    const { jwtSecret } = await loadSettings(c.env)
    const payload = await verifyJWT(token, jwtSecret)

    if (!payload) {
      logger.warning('Token 驗證失敗，重定向到登入頁', { prefix: 'Auth' })
      // 清除無效 Cookie
      clearTokenCookie(c)
      return c.redirect('/')
    }

    // 將用戶信息存入 context
    c.set('user', payload)

    logger.jwt(`頁面認證成功: ${payload.username}`)

    await next()
  } catch (error) {
    logger.error('頁面認證中間件執行失敗', error, { prefix: 'Auth' })
    return c.redirect('/')
  }
}
