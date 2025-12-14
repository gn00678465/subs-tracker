import type { Context, Next } from 'hono'
import type { HonoEnv, JWTPayload } from '../types'
import { getConfig } from '../services/config'
import { extractToken, verifyJWT } from '../utils/crypto'
import * as logger from '../utils/logger'

/**
 * JWT 認證中間件
 * 驗證請求中的 JWT Token，並將用戶信息存入 context
 */
export async function authMiddleware(
  c: Context<HonoEnv>,
  next: Next,
): Promise<Response | void> {
  try {
    // 提取 Token（優先級：Cookie > Authorization Header）
    const token = extractToken(c)

    if (!token) {
      logger.warning('未提供認證 Token', { prefix: 'Auth' })
      return c.json({
        success: false,
        message: '未授權訪問，請先登入',
      }, 401)
    }

    // 獲取配置以獲取 JWT_SECRET
    const config = await getConfig(c.env)

    // 驗證 Token
    const payload = await verifyJWT(token, config.JWT_SECRET)

    if (!payload) {
      logger.warning('Token 驗證失敗', { prefix: 'Auth' })
      return c.json({
        success: false,
        message: '認證無效或已過期，請重新登入',
      }, 401)
    }

    // 將用戶信息存入 context
    c.set('user', payload)

    logger.jwt(`用戶已認證: ${payload.username}`)

    // 繼續處理請求
    await next()
  }
  catch (error) {
    logger.error('認證中間件執行失敗', error, { prefix: 'Auth' })
    return c.json({
      success: false,
      message: '認證處理失敗',
    }, 500)
  }
}

/**
 * 可選的認證中間件
 * 如果有 Token 則驗證，沒有 Token 則繼續處理（不阻斷請求）
 */
export async function optionalAuthMiddleware(
  c: Context<HonoEnv>,
  next: Next,
): Promise<void> {
  try {
    const token = extractToken(c)

    if (token) {
      const config = await getConfig(c.env)
      const payload = await verifyJWT(token, config.JWT_SECRET)

      if (payload) {
        c.set('user', payload)
        logger.jwt(`可選認證成功: ${payload.username}`)
      }
    }

    await next()
  }
  catch (error) {
    logger.error('可選認證中間件執行失敗', error, { prefix: 'Auth' })
    // 即使出錯也繼續處理請求
    await next()
  }
}
