import type { CalendarDate } from '../utils/calendarDate'

// 通用環境變數綁定類型
export interface Bindings {
  DB: D1Database
  /** 只作為舊版資料的匯入來源 */
  SUBSCRIPTIONS_KV: KVNamespace
}

export interface HonoEnv {
  Bindings: Bindings
  Variables: {
    user: JWTPayload
  }
}

// 訂閱數據結構
export type PeriodUnit = 'day' | 'week' | 'month' | 'year'

/** 'default' 沿用設定的預設提前天數；'off' 不提醒；數字是提前天數 */
export type ReminderSetting = 'default' | 'off' | number

export interface Subscription {
  id: string
  name: string
  category: string
  currency: string
  price: number
  periodValue: number
  periodUnit: PeriodUnit
  /** 下次扣款日；試用中的訂閱是試用結束日 */
  expiryDate: CalendarDate
  autoRenew: boolean
  isFreeTrial: boolean
  reminder: ReminderSetting
  /** 要在這天之前取消才不會扣款；設定時提醒依這天計算 */
  cancelByDate?: CalendarDate
  paymentMethod: string
  website: string
  startDate?: CalendarDate
  notes: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastReminderSentAt?: string
  lastCheckedExpiryDate?: CalendarDate
}

// 配置數據結構
export interface Config {
  ADMIN_USERNAME: string
  ADMIN_PASSWORD: string
  JWT_SECRET: string
  TIMEZONE: string
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_CHAT_ID?: string
  WEBHOOK_URL?: string
  WEBHOOK_METHOD?: string
  WEBHOOK_HEADERS?: string
  WEBHOOK_TEMPLATE?: string
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
  EMAIL_FROM_NAME?: string
  EMAIL_TO?: string
  BARK_SERVER?: string
  BARK_KEY?: string
  BARK_SAVE?: string
  BARK_QUERY?: string
  /** 每日發送提醒的小時（0-23），以 TIMEZONE 計算 */
  REMINDER_HOUR: number
  ENABLED_NOTIFIERS: string[]
  REMINDER_MODE?: 'ONCE' | 'DAILY'
  /** 訂閱的提醒設為「沿用預設」時的提前天數 */
  DEFAULT_REMINDER_DAYS: number

  // WebAuthn 配置
  WEBAUTHN_ENABLED?: boolean
  WEBAUTHN_RP_NAME?: string
  WEBAUTHN_RP_ID?: string
  WEBAUTHN_RP_ORIGINS?: string[]
  WEBAUTHN_ATTESTATION?: 'none' | 'direct' | 'enterprise'
  WEBAUTHN_AUTHENTICATOR_ATTACHMENT?: 'platform' | 'cross-platform'
  WEBAUTHN_RESIDENT_KEY?: 'required' | 'preferred' | 'discouraged'
  WEBAUTHN_USER_VERIFICATION?: 'required' | 'preferred' | 'discouraged'
  WEBAUTHN_TIMEOUT?: number
  WEBAUTHN_HINTS?: ('security-key' | 'client-device' | 'hybrid')[]
}

/**
 * JWT Payload 結構（兼容 Hono JWT）
 */
export interface JWTPayload {
  username: string
  iat: number
  exp?: number
  [key: string]: unknown // Hono JWT 要求的索引簽名
}
