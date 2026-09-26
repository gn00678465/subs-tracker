import type { ChannelConfig } from '../../db/settings'

/**
 * 通知選項
 */
export interface NotificationOptions {
  title: string
  content: string
  timestamp?: string
}

/**
 * 單個渠道的通知結果
 */
export interface ChannelResult {
  channel: string // 'telegram' | 'bark' | 'email' | 'webhook'
  success: boolean
  error?: string
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
export type ChannelSender = (options: NotificationOptions, config: ChannelConfig) => Promise<ChannelResult>

/**
 * 渠道配置驗證函數介面
 */
export type ChannelValidator = (config: ChannelConfig) => {
  isValid: boolean
  missingFields?: string[]
}
