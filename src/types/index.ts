// 通用環境變數綁定類型
export interface Bindings {
  SUBSCRIPTIONS_KV: KVNamespace

  // 認證相關
  ADMIN_USERNAME?: string
  ADMIN_PASSWORD?: string
  JWT_SECRET?: string
  API_TOKEN?: string

  // 時區配置
  TIMEZONE?: string

  // 通知渠道配置
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_CHAT_ID?: string
  NOTIFYX_API_KEY?: string
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

  // 其他配置
  NOTIFICATION_HOURS?: string
  ENABLED_NOTIFIERS?: string
}

export interface HonoEnv {
  Bindings: Bindings
  Variables: {
    user: JWTPayload
  }
}

// 訂閱數據結構
export interface Subscription {
  id: string
  name: string
  customType?: string
  category?: string
  currency?: string
  price?: string
  startDate?: string
  expiryDate: string
  hasEndDate?: boolean
  autoRenew: boolean
  isFreeTrial?: boolean
  periodValue?: number
  periodUnit?: 'day' | 'month' | 'year'
  periodMethod?: 'credit' | 'apple' | 'google' | 'paypal' | 'other'
  website?: string
  isReminderSet?: boolean
  reminderMe?: number // 提前提醒天數 (1, 3, 7, 14, 21, 30, 60, 90)
  reminderUnit?: 'day' | 'hour' // 向後兼容字段
  reminderValue?: number // 向後兼容字段
  reminderDays?: number // 向後兼容字段
  reminderHours?: number // 向後兼容字段
  notes?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// 配置數據結構
export interface Config {
  ADMIN_USERNAME: string
  ADMIN_PASSWORD: string
  JWT_SECRET: string
  API_TOKEN?: string
  TIMEZONE: string
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_CHAT_ID?: string
  NOTIFYX_API_KEY?: string
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
  NOTIFICATION_HOURS: number[]
  ENABLED_NOTIFIERS: string[]
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

// ===== 自定義事件類型 =====

/**
 * 訂閱保存成功事件詳情
 */
export interface SubscriptionSavedEventDetail {
  subscriptionId: string
  action: 'create' | 'update'
}

/**
 * 訂閱保存失敗事件詳情
 */
export interface SubscriptionSaveFailedEventDetail {
  error: Error | string
  subscriptionId?: string
}

/**
 * 訂閱刪除事件詳情
 */
export interface SubscriptionDeletedEventDetail {
  subscriptionId: string
}

/**
 * 訂閱狀態變更事件詳情
 */
export interface SubscriptionStatusChangedEventDetail {
  subscriptionId: string
  isActive: boolean
}

/**
 * 訂閱保存成功事件
 */
export interface SubscriptionSavedEvent extends CustomEvent<SubscriptionSavedEventDetail> {
  type: 'subscription-saved'
}

/**
 * 訂閱保存失敗事件
 */
export interface SubscriptionSaveFailedEvent extends CustomEvent<SubscriptionSaveFailedEventDetail> {
  type: 'subscription-save-failed'
}

/**
 * 訂閱刪除事件
 */
export interface SubscriptionDeletedEvent extends CustomEvent<SubscriptionDeletedEventDetail> {
  type: 'subscription-deleted'
}

/**
 * 訂閱狀態變更事件
 */
export interface SubscriptionStatusChangedEvent extends CustomEvent<SubscriptionStatusChangedEventDetail> {
  type: 'subscription-status-changed'
}
