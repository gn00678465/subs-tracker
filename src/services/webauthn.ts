import type { Base64URLString } from '@simplewebauthn/server'
import type { Bindings, Config } from '../types'
import type { StoredChallenge, StoredCredential, UserCredentialsIndex } from '../types/webauthn'
import { Buffer } from 'node:buffer'
import psl from 'psl'
import * as logger from '../utils/logger'

/**
 * WebAuthn 服務層
 * 處理憑證與 Challenge 的 KV 操作
 */

// ==================== 憑證管理 ====================

/**
 * 儲存憑證到 KV 並更新使用者索引
 */
export async function storeCredential(
  username: string,
  credential: StoredCredential,
  env: Bindings,
): Promise<void> {
  try {
    // 儲存憑證
    await env.SUBSCRIPTIONS_KV.put(
      `webauthn:credential:${credential.credentialID}`,
      JSON.stringify(credential),
    )

    // 更新使用者索引
    const indexKey = `webauthn:user:${username}:credentials`
    const existing = await env.SUBSCRIPTIONS_KV.get(indexKey)
    const index: UserCredentialsIndex = existing
      ? JSON.parse(existing)
      : { credentialIDs: [] }

    if (!index.credentialIDs.includes(credential.credentialID)) {
      index.credentialIDs.push(credential.credentialID)
      await env.SUBSCRIPTIONS_KV.put(indexKey, JSON.stringify(index))
    }

    logger.config(`Stored credential for user: ${username}`)
  }
  catch (error) {
    logger.error('Failed to store credential', error, { prefix: 'WebAuthn' })
    throw error
  }
}

/**
 * 取得單一憑證
 */
export async function getCredential(
  credentialID: Base64URLString,
  env: Bindings,
): Promise<StoredCredential | null> {
  try {
    const data = await env.SUBSCRIPTIONS_KV.get(`webauthn:credential:${credentialID}`)
    return data ? JSON.parse(data) : null
  }
  catch (error) {
    logger.error('Failed to get credential', error, { prefix: 'WebAuthn' })
    return null
  }
}

/**
 * 取得使用者的所有憑證
 */
export async function getUserCredentials(
  username: string,
  env: Bindings,
): Promise<StoredCredential[]> {
  try {
    const indexKey = `webauthn:user:${username}:credentials`
    const indexData = await env.SUBSCRIPTIONS_KV.get(indexKey)

    if (!indexData)
      return []

    const index: UserCredentialsIndex = JSON.parse(indexData)
    const credentials = await Promise.all(
      index.credentialIDs.map(id =>
        env.SUBSCRIPTIONS_KV.get(`webauthn:credential:${id}`),
      ),
    )

    return credentials
      .filter(c => c !== null)
      .map(c => JSON.parse(c!))
  }
  catch (error) {
    logger.error('Failed to get user credentials', error, { prefix: 'WebAuthn' })
    return []
  }
}

/**
 * 刪除憑證並更新使用者索引
 */
export async function deleteCredential(
  credentialID: Base64URLString,
  username: string,
  env: Bindings,
): Promise<void> {
  try {
    // 刪除憑證
    await env.SUBSCRIPTIONS_KV.delete(`webauthn:credential:${credentialID}`)

    // 更新使用者索引
    const indexKey = `webauthn:user:${username}:credentials`
    const indexData = await env.SUBSCRIPTIONS_KV.get(indexKey)

    if (indexData) {
      const index: UserCredentialsIndex = JSON.parse(indexData)
      index.credentialIDs = index.credentialIDs.filter(id => id !== credentialID)
      await env.SUBSCRIPTIONS_KV.put(indexKey, JSON.stringify(index))
    }

    logger.config(`Deleted credential for user: ${username}`)
  }
  catch (error) {
    logger.error('Failed to delete credential', error, { prefix: 'WebAuthn' })
    throw error
  }
}

/**
 * 更新憑證 counter（含安全檢查）
 */
export async function updateCredentialCounter(
  credentialID: Base64URLString,
  newCounter: number,
  env: Bindings,
): Promise<void> {
  try {
    const key = `webauthn:credential:${credentialID}`
    const data = await env.SUBSCRIPTIONS_KV.get(key)

    if (!data) {
      throw new Error('Credential not found')
    }

    const credential: StoredCredential = JSON.parse(data)

    if (newCounter > 0 && newCounter <= credential.counter) {
      logger.warning('Counter decreased - possible replay attack', {
        prefix: 'WebAuthn',
        data: { credentialID, oldCounter: credential.counter, newCounter },
      })
      throw new Error('Counter decreased - possible replay attack')
    }

    credential.counter = newCounter
    credential.lastUsedAt = new Date().toISOString()

    await env.SUBSCRIPTIONS_KV.put(key, JSON.stringify(credential))
    logger.config(`Updated counter for credential: ${credentialID}`)
  }
  catch (error) {
    logger.error('Failed to update credential counter', error, { prefix: 'WebAuthn' })
    throw error
  }
}

/**
 * 更新憑證暱稱
 */
export async function updateCredentialNickname(
  credentialID: Base64URLString,
  nickname: string,
  env: Bindings,
): Promise<void> {
  try {
    const key = `webauthn:credential:${credentialID}`
    const data = await env.SUBSCRIPTIONS_KV.get(key)

    if (!data) {
      throw new Error('Credential not found')
    }

    const credential: StoredCredential = JSON.parse(data)
    credential.nickname = nickname

    await env.SUBSCRIPTIONS_KV.put(key, JSON.stringify(credential))
    logger.config(`Updated nickname for credential: ${credentialID}`)
  }
  catch (error) {
    logger.error('Failed to update credential nickname', error, { prefix: 'WebAuthn' })
    throw error
  }
}

// ==================== Challenge 管理 ====================

/**
 * 儲存 Challenge（TTL 300 秒）
 */
export async function storeChallenge(
  challenge: string,
  type: 'registration' | 'authentication',
  env: Bindings,
  username?: string,
): Promise<void> {
  try {
    const data: StoredChallenge = {
      challenge,
      type,
      createdAt: new Date().toISOString(),
      username,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }

    // TTL: 5 分鐘（300 秒）
    await env.SUBSCRIPTIONS_KV.put(
      `webauthn:challenge:${challenge}`,
      JSON.stringify(data),
      { expirationTtl: 300 },
    )

    logger.config('Stored challenge', { prefix: 'WebAuthn' })
  }
  catch (error) {
    logger.error('Failed to store challenge', error, { prefix: 'WebAuthn' })
    throw error
  }
}

/**
 * 取得並刪除 Challenge（一次性使用）
 */
export async function getChallenge(
  challenge: string,
  env: Bindings,
): Promise<StoredChallenge | null> {
  try {
    const key = `webauthn:challenge:${challenge}`
    const data = await env.SUBSCRIPTIONS_KV.get(key)

    if (!data)
      return null

    // 立即刪除（一次性使用）
    await env.SUBSCRIPTIONS_KV.delete(key)

    return JSON.parse(data)
  }
  catch (error) {
    logger.error('Failed to get challenge', error, { prefix: 'WebAuthn' })
    return null
  }
}

// ==================== 工具函數 ====================

/**
 * 從 Origin 提取根網域（RP ID）
 * 例如：https://app.example.com → example.com
 */
export function extractRPID(origin: string | undefined): string {
  if (!origin)
    throw new Error('Origin is required')

  const url = new URL(origin)
  const hostname = url.hostname

  const pslDomain = psl.get(hostname)
  if (pslDomain) {
    return pslDomain
  }

  const parts = hostname.split('.')
  if (parts.length >= 2) {
    return parts.slice(-2).join('.')
  }
  return hostname
}

/**
 * 從配置中提取所有相關的 RP ID（用於 ROR）
 */
export function extractRelatedOrigins(config: Config): string[] {
  const origins = config.WEBAUTHN_RP_ORIGINS || []
  return origins.map((origin) => {
    try {
      return extractRPID(origin)
    }
    catch {
      return ''
    }
  }).filter(Boolean)
}

/**
 * 驗證 Origin 是否在允許清單中
 */
export function validateOrigin(
  requestOrigin: string,
  config: Config,
): boolean {
  const allowedOrigins = config.WEBAUTHN_RP_ORIGINS || []

  // 檢查精確匹配
  if (allowedOrigins.includes(requestOrigin)) {
    return true
  }

  // 檢查 RP ID 是否匹配
  const requestRPID = extractRPID(requestOrigin)
  if (requestRPID === config.WEBAUTHN_RP_ID) {
    return true
  }

  return false
}

/**
 * 從 WebAuthn 回應中安全地提取 Challenge
 */
export function extractChallenge(body: any): string | undefined {
  try {
    // 優先從 clientDataJSON 提取（標準做法）
    const clientDataJSON = body?.response?.clientDataJSON
    if (typeof clientDataJSON === 'string' && clientDataJSON.length > 0) {
      const decoded = Buffer.from(clientDataJSON, 'base64')
      const parsed = JSON.parse(decoded.toString('utf8'))
      if (parsed && typeof parsed.challenge === 'string') {
        return parsed.challenge
      }
    }
  }
  catch (e) {
    logger.warning('Failed to parse clientDataJSON when extracting challenge', {
      prefix: 'WebAuthn',
      data: { error: e instanceof Error ? e.message : String(e) },
    })
  }

  // 備選：直接從 body 取得（某些自定義實作或測試可能用到）
  if (typeof body?.challenge === 'string' && body.challenge.length > 0) {
    return body.challenge
  }

  return undefined
}
