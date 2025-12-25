import type { Config } from '../../types'

/**
 * 通知選項
 */
export interface NotificationOptions {
  title: string
  content: string
  timestamp?: string
  metadata?: Record<string, any> // 額外元數據（如 tags）
}

/**
 * 單個渠道的通知結果
 */
export interface ChannelResult {
  channel: string // 'telegram' | 'bark' | 'email' | 'webhook'
  success: boolean
  message?: string
  error?: string
  details?: any // 渠道特定的回應資料
}

/**
 * 聚合通知結果
 */
export interface NotificationResult {
  totalChannels: number
  successCount: number
  failureCount: number
  results: ChannelResult[]
}

/**
 * 渠道發送函數介面
 */
export type ChannelSender = (
  options: NotificationOptions,
  config: Config,
) => Promise<ChannelResult>

/**
 * 渠道配置驗證函數介面
 */
export type ChannelValidator = (config: Config) => {
  isValid: boolean
  missingFields?: string[]
}
