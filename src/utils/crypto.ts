import type { Context } from 'hono'
import type { JWTPayload } from '../types'
import crypto from 'node:crypto'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { sign, verify } from 'hono/jwt'
import * as logger from './logger'

// JWT 配置常量
export const JWT_EXPIRATION_SECONDS = 60 * 60 * 24 * 7 // 7 天
export const COOKIE_MAX_AGE = JWT_EXPIRATION_SECONDS
export const COOKIE_NAME = 'token'

/**
 * 生成隨機密鑰（64 字元）
 */
export function generateRandomSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const randomBytes = crypto.randomBytes(64)
  let result = ''
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(randomBytes[i] % chars.length)
  }
  return result
}

/**
 * 生成 JWT Token
 * @param username 用戶名
 * @param secret JWT 密鑰
 * @param expirationSeconds 過期時間（秒），預設 7 天
 */
export async function generateJWT(
  username: string,
  secret: string,
  expirationSeconds = JWT_EXPIRATION_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: JWTPayload = {
    username,
    iat: now,
    exp: now + expirationSeconds,
  }

  try {
    return await sign(payload, secret, 'HS256')
  }
  catch (error) {
    logger.error('JWT 生成失敗', error, { prefix: 'JWT' })
    throw new Error('JWT 生成失敗')
  }
}

/**
 * 驗證 JWT Token
 * @param token JWT Token
 * @param secret JWT 密鑰
 * @returns Payload 或 null（驗證失敗）
 */
export async function verifyJWT(
  token: string,
  secret: string,
): Promise<JWTPayload | null> {
  try {
    if (!token || !secret) {
      logger.jwt('Token 或 Secret 為空')
      return null
    }

    const decoded = await verify(token, secret, 'HS256')
    const payload = decoded as JWTPayload

    // 驗證必要字段
    if (!payload.username || typeof payload.username !== 'string') {
      logger.jwt('Payload 格式錯誤')
      return null
    }

    // 檢查過期時間
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      logger.jwt('Token 已過期')
      return null
    }

    logger.jwt(`驗證成功，用戶: ${payload.username}`)
    return payload
  }
  catch (error) {
    logger.error('JWT 驗證過程出錯', error, { prefix: 'JWT' })
    return null
  }
}

/**
 * 從請求中提取 JWT Token
 * 優先級：Cookie > Authorization Header
 * @param c Hono Context
 */
export function extractToken(c: Context): string | null {
  // 1. 從 Cookie 提取（使用 Hono getCookie）
  const tokenFromCookie = getCookie(c, COOKIE_NAME)
  if (tokenFromCookie) {
    return tokenFromCookie
  }

  // 2. 從 Authorization Header 提取
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  return null
}

/**
 * 設置 JWT Cookie
 * @param c Hono Context
 * @param token JWT Token
 * @param maxAge 過期時間（秒）
 */
export function setTokenCookie(c: Context, token: string, maxAge = COOKIE_MAX_AGE): void {
  setCookie(c, COOKIE_NAME, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'Strict',
    secure: true,
    maxAge,
  })
}

/**
 * 清除 JWT Cookie
 * @param c Hono Context
 */
export function clearTokenCookie(c: Context): void {
  deleteCookie(c, COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    sameSite: 'Strict',
  })
}

/**
 * 使用 HMAC-SHA256 Hash 密碼
 * @param password 原始密碼
 * @param secret 密鑰（通常為 JWT_SECRET）
 */
export async function hashPassword(password: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(password)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 驗證密碼
 * @param inputPassword 用戶輸入的密碼
 * @param storedHash 存儲的 Hash 值
 * @param secret 密鑰
 */
export async function verifyPassword(
  inputPassword: string,
  storedHash: string,
  secret: string,
): Promise<boolean> {
  const inputHash = await hashPassword(inputPassword, secret)
  return inputHash === storedHash
}
