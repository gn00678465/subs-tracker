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

/**
 * JWT Payload 結構（兼容 Hono JWT）
 */
export interface JWTPayload {
  username: string
  iat: number
  exp?: number
  [key: string]: unknown // Hono JWT 要求的索引簽名
}
