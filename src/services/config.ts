import type { Bindings, Config } from '../types'
import { generateRandomSecret, hashPassword } from '../utils/crypto'
import * as logger from '../utils/logger'

/**
 * 配置服務模組
 * 處理系統配置的讀取、更新與預設值管理
 */

// ==================== Default Configuration ====================

/**
 * 預設配置值
 * 注意：排除 SHOW_LUNAR 和 WECHATBOT_* 字段（按重構計畫移除）
 */
export const DEFAULT_CONFIG: Config = {
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'password',
  JWT_SECRET: '', // 首次啟動時自動生成
  API_TOKEN: '',
  TIMEZONE: 'UTC',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  WEBHOOK_URL: '',
  WEBHOOK_METHOD: 'POST',
  WEBHOOK_HEADERS: '',
  WEBHOOK_TEMPLATE: '',
  RESEND_API_KEY: '',
  EMAIL_FROM: '',
  EMAIL_FROM_NAME: '',
  EMAIL_TO: '',
  BARK_SERVER: 'https://api.day.app',
  BARK_KEY: '',
  BARK_SAVE: 'false',
  BARK_QUERY: '',
  NOTIFICATION_HOURS: [], // 空陣列表示允許所有小時
  ENABLED_NOTIFIERS: [],
  REMINDER_MODE: 'ONCE', // 默認為首次觸發模式
}

// ==================== Configuration Operations ====================

/**
 * 從 KV 獲取配置，並與預設值合併
 * 自動生成 JWT_SECRET（如果缺失或為舊值）
 */
export async function getConfig(env: Bindings): Promise<Config> {
  try {
    if (!env.SUBSCRIPTIONS_KV) {
      logger.error('KV 存儲未綁定', null, { prefix: 'Config' })
      throw new Error('KV 存儲未綁定')
    }

    const data = await env.SUBSCRIPTIONS_KV.get('config')
    logger.config(`從 KV 讀取配置: ${data ? '成功' : '空配置'}`)

    const stored = data ? JSON.parse(data) : {}

    // 確保 JWT_SECRET 的一致性
    let jwtSecret = stored.JWT_SECRET
    if (!jwtSecret || jwtSecret === 'your-secret-key') {
      jwtSecret = generateRandomSecret()
      logger.config('生成新的 JWT 密鑰')

      // 保存新的 JWT 密鑰
      const updatedConfig = { ...stored, JWT_SECRET: jwtSecret }
      await env.SUBSCRIPTIONS_KV.put('config', JSON.stringify(updatedConfig))
    }

    // 合併預設值與存儲值
    const config: Config = {
      ADMIN_USERNAME: stored.ADMIN_USERNAME || DEFAULT_CONFIG.ADMIN_USERNAME,
      ADMIN_PASSWORD: stored.ADMIN_PASSWORD || DEFAULT_CONFIG.ADMIN_PASSWORD,
      JWT_SECRET: jwtSecret,
      API_TOKEN: stored.API_TOKEN || DEFAULT_CONFIG.API_TOKEN,
      TIMEZONE: stored.TIMEZONE || DEFAULT_CONFIG.TIMEZONE,
      TELEGRAM_BOT_TOKEN: stored.TELEGRAM_BOT_TOKEN || stored.TG_BOT_TOKEN || DEFAULT_CONFIG.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID: stored.TELEGRAM_CHAT_ID || stored.TG_CHAT_ID || DEFAULT_CONFIG.TELEGRAM_CHAT_ID,
      WEBHOOK_URL: stored.WEBHOOK_URL || DEFAULT_CONFIG.WEBHOOK_URL,
      WEBHOOK_METHOD: stored.WEBHOOK_METHOD || DEFAULT_CONFIG.WEBHOOK_METHOD,
      WEBHOOK_HEADERS: stored.WEBHOOK_HEADERS || DEFAULT_CONFIG.WEBHOOK_HEADERS,
      WEBHOOK_TEMPLATE: stored.WEBHOOK_TEMPLATE || DEFAULT_CONFIG.WEBHOOK_TEMPLATE,
      RESEND_API_KEY: stored.RESEND_API_KEY || DEFAULT_CONFIG.RESEND_API_KEY,
      EMAIL_FROM: stored.EMAIL_FROM || DEFAULT_CONFIG.EMAIL_FROM,
      EMAIL_FROM_NAME: stored.EMAIL_FROM_NAME || DEFAULT_CONFIG.EMAIL_FROM_NAME,
      EMAIL_TO: stored.EMAIL_TO || DEFAULT_CONFIG.EMAIL_TO,
      BARK_SERVER: stored.BARK_SERVER || DEFAULT_CONFIG.BARK_SERVER,
      BARK_KEY: stored.BARK_KEY || stored.BARK_DEVICE_KEY || DEFAULT_CONFIG.BARK_KEY,
      BARK_SAVE: stored.BARK_SAVE || stored.BARK_IS_ARCHIVE || DEFAULT_CONFIG.BARK_SAVE,
      BARK_QUERY: stored.BARK_QUERY || DEFAULT_CONFIG.BARK_QUERY,
      NOTIFICATION_HOURS: normalizeNotificationHours(stored.NOTIFICATION_HOURS),
      ENABLED_NOTIFIERS: Array.isArray(stored.ENABLED_NOTIFIERS)
        ? stored.ENABLED_NOTIFIERS
        : DEFAULT_CONFIG.ENABLED_NOTIFIERS,
      REMINDER_MODE: (stored.REMINDER_MODE === 'ONCE' || stored.REMINDER_MODE === 'DAILY')
        ? stored.REMINDER_MODE
        : DEFAULT_CONFIG.REMINDER_MODE,
    }

    // 檢測並強制升級明文密碼
    if (isPlainTextPassword(config.ADMIN_PASSWORD)) {
      logger.config('偵測到明文密碼，強制升級為 Hash')
      const hashedPassword = await hashPassword(config.ADMIN_PASSWORD, jwtSecret)

      // 更新配置並保存（確保包含 JWT_SECRET）
      const updatedStoredConfig = {
        ...stored,
        JWT_SECRET: jwtSecret,
        ADMIN_PASSWORD: hashedPassword,
      }
      await env.SUBSCRIPTIONS_KV.put('config', JSON.stringify(updatedStoredConfig))

      // 更新返回的 config 對象
      config.ADMIN_PASSWORD = hashedPassword
      logger.config('密碼已自動升級為 Hash 並保存')
    }

    logger.config(`配置加載完成，用戶名: ${config.ADMIN_USERNAME}`)
    return config
  }
  catch (error) {
    logger.error('獲取配置失敗', error, { prefix: 'Config' })

    // 返回預設配置（含自動生成的 JWT_SECRET）
    return {
      ...DEFAULT_CONFIG,
      JWT_SECRET: generateRandomSecret(),
    }
  }
}

/**
 * 更新配置到 KV
 */
export async function updateConfig(
  newConfig: Partial<Config>,
  env: Bindings,
): Promise<{ success: boolean, message?: string }> {
  try {
    // 讀取現有配置
    const currentConfig = await getConfig(env)

    // 合併配置（保留舊值 + 覆蓋新值）
    const updatedConfig: Config = {
      ...currentConfig,
      ...newConfig,
    }

    // 特殊處理：ADMIN_PASSWORD 需要加密
    if (newConfig.ADMIN_PASSWORD) {
      logger.config('開始加密管理員密碼')
      updatedConfig.ADMIN_PASSWORD = await hashPassword(
        newConfig.ADMIN_PASSWORD,
        currentConfig.JWT_SECRET,
      )
      logger.config('管理員密碼已成功加密並更新')
    }

    // 特殊處理：NOTIFICATION_HOURS 需要規範化
    if (newConfig.NOTIFICATION_HOURS !== undefined) {
      updatedConfig.NOTIFICATION_HOURS = normalizeNotificationHours(newConfig.NOTIFICATION_HOURS)
    }

    // 保存到 KV
    await env.SUBSCRIPTIONS_KV.put('config', JSON.stringify(updatedConfig))

    logger.config('配置更新成功')
    return { success: true }
  }
  catch (error) {
    logger.error('更新配置失敗', error, { prefix: 'Config' })
    return {
      success: false,
      message: error instanceof Error ? error.message : '更新配置失敗',
    }
  }
}

/**
 * 獲取安全配置（移除敏感字段）
 * 用於返回給前端
 */
export function getSafeConfig(config: Config): Omit<Config, 'JWT_SECRET' | 'ADMIN_PASSWORD'> {
  const { JWT_SECRET, ADMIN_PASSWORD, ...safeConfig } = config
  return safeConfig
}

// ==================== Helper Functions ====================

/**
 * 規範化通知小時設定
 * 支援格式：
 * - [] 或 undefined：表示所有小時
 * - ['*'] 或 ['ALL']：表示所有小時
 * - [0, 1, 2, ...]：數字陣列
 * - ['0', '1', '2', ...]：字串陣列（轉為數字）
 */
function normalizeNotificationHours(hours: any): number[] {
  // 未設定或空陣列：允許所有小時
  if (!hours || (Array.isArray(hours) && hours.length === 0)) {
    return []
  }

  // 特殊值：'*' 或 'ALL'
  if (Array.isArray(hours) && (hours.includes('*') || hours.includes('ALL'))) {
    return []
  }

  // 字串或數字陣列：轉為數字並過濾有效值
  if (Array.isArray(hours)) {
    return hours
      .map(h => typeof h === 'string' ? Number.parseInt(h, 10) : h)
      .filter(h => !Number.isNaN(h) && h >= 0 && h <= 23)
  }

  // 無效格式：回退到預設
  logger.warning(`無效的 NOTIFICATION_HOURS 格式: ${JSON.stringify(hours)}`, { prefix: 'Config' })
  return []
}

/**
 * 檢查當前小時是否允許發送通知
 * @param config 配置對象
 * @param currentHour 當前小時 (0-23)
 */
export function isNotificationAllowedAtHour(config: Config, currentHour: number): boolean {
  const { NOTIFICATION_HOURS } = config

  // 空陣列表示允許所有小時
  if (NOTIFICATION_HOURS.length === 0) {
    return true
  }

  // 檢查當前小時是否在允許列表中
  return NOTIFICATION_HOURS.includes(currentHour)
}

/**
 * 檢測密碼是否為明文
 * Hash 值為固定長度的 hex 字串（64 字元）
 * HMAC-SHA256 會產生 32 字節 = 64 個 hex 字符
 */
function isPlainTextPassword(password: string): boolean {
  // Hash 值的特徵：64 字符的純 hex 字串
  // 如果不符合這個特徵，視為明文
  if (password.length !== 64) {
    return true
  }

  // 檢查是否為純 hex 字串（0-9, a-f）
  if (!/^[0-9a-f]{64}$/i.test(password)) {
    return true
  }

  // 符合 Hash 格式
  return false
}
