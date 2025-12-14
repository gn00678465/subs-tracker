/**
 * Logger 服務模組
 * 提供統一的日誌記錄功能，支援不同級別的日誌分類
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'REQUEST' | 'CONFIG' | 'KV' | 'JWT' | 'SUBSCRIPTION' | 'NOTIFICATION'

interface LogOptions {
  timestamp?: boolean
  prefix?: string
  data?: any
}

/**
 * 日誌級別優先級（數字越大越重要）
 */
const LOG_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  REQUEST: 2,
  CONFIG: 2,
  KV: 2,
  JWT: 2,
  SUBSCRIPTION: 2,
  NOTIFICATION: 2,
  WARNING: 3,
  ERROR: 4,
}

/**
 * 當前最低日誌級別（可通過環境變量配置）
 * 生產環境建議設為 INFO，開發環境可設為 DEBUG
 */
let MIN_LOG_LEVEL: LogLevel = 'DEBUG'

/**
 * 設置最低日誌級別
 */
export function setMinLogLevel(level: LogLevel): void {
  MIN_LOG_LEVEL = level
}

/**
 * 格式化時間戳
 */
function formatTimestamp(): string {
  const now = new Date()
  return now.toISOString()
}

/**
 * 判斷是否應該記錄此日誌
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_PRIORITY[level] >= LOG_PRIORITY[MIN_LOG_LEVEL]
}

/**
 * 核心日誌函數
 */
function log(level: LogLevel, message: string, options: LogOptions = {}): void {
  if (!shouldLog(level)) {
    return
  }

  const parts: string[] = []

  // 時間戳
  if (options.timestamp !== false) {
    parts.push(`[${formatTimestamp()}]`)
  }

  // 日誌級別
  parts.push(`[${level}]`)

  // 自定義前綴
  if (options.prefix) {
    parts.push(`[${options.prefix}]`)
  }

  // 消息
  parts.push(message)

  const logMessage = parts.join(' ')

  // 根據級別選擇 console 方法
  switch (level) {
    case 'ERROR':
      console.error(logMessage, options.data || '')
      break
    case 'WARNING':
      console.warn(logMessage, options.data || '')
      break
    case 'DEBUG':
      console.debug(logMessage, options.data || '')
      break
    default:
      console.log(logMessage, options.data || '')
  }
}

// ==================== 公開的日誌方法 ====================

/**
 * DEBUG 級別日誌（最詳細）
 */
export function debug(message: string, options?: LogOptions): void {
  log('DEBUG', message, options)
}

/**
 * INFO 級別日誌（一般信息）
 */
export function info(message: string, options?: LogOptions): void {
  log('INFO', message, options)
}

/**
 * WARNING 級別日誌（警告）
 */
export function warning(message: string, options?: LogOptions): void {
  log('WARNING', message, options)
}

/**
 * ERROR 級別日誌（錯誤）
 */
export function error(message: string, error?: any, options?: LogOptions): void {
  const errorData = error instanceof Error
    ? { message: error.message, stack: error.stack }
    : error

  log('ERROR', message, { ...options, data: errorData })
}

/**
 * REQUEST 級別日誌（HTTP 請求）
 */
export function request(method: string, path: string, options?: LogOptions): void {
  log('REQUEST', `${method} ${path}`, options)
}

/**
 * CONFIG 級別日誌（配置相關）
 */
export function config(message: string, options?: LogOptions): void {
  log('CONFIG', message, options)
}

/**
 * KV 級別日誌（KV 操作）
 */
export function kv(message: string, options?: LogOptions): void {
  log('KV', message, options)
}

/**
 * JWT 級別日誌（JWT 驗證）
 */
export function jwt(message: string, options?: LogOptions): void {
  log('JWT', message, options)
}

/**
 * SUBSCRIPTION 級別日誌（訂閱操作）
 */
export function subscription(message: string, options?: LogOptions): void {
  log('SUBSCRIPTION', message, options)
}

/**
 * NOTIFICATION 級別日誌（通知發送）
 */
export function notification(message: string, options?: LogOptions): void {
  log('NOTIFICATION', message, options)
}

// ==================== 輔助方法 ====================

/**
 * 記錄請求開始
 */
export function logRequestStart(method: string, path: string, options?: Omit<LogOptions, 'timestamp'>): void {
  request(method, path, { ...options, timestamp: true })
}

/**
 * 記錄請求完成
 */
export function logRequestEnd(method: string, path: string, duration: number, status: number): void {
  const message = `${method} ${path} - ${status} (${duration}ms)`
  if (status >= 500) {
    error(message)
  }
  else if (status >= 400) {
    warning(message)
  }
  else {
    info(message)
  }
}

/**
 * 記錄 KV 操作
 */
export function logKvOperation(operation: 'get' | 'put' | 'delete', key: string, success: boolean): void {
  const message = `KV ${operation.toUpperCase()} '${key}' - ${success ? '成功' : '失敗'}`
  if (success) {
    kv(message)
  }
  else {
    error(message)
  }
}

/**
 * 創建帶前綴的 logger
 */
export function createLogger(prefix: string) {
  return {
    debug: (message: string, options?: Omit<LogOptions, 'prefix'>) =>
      debug(message, { ...options, prefix }),
    info: (message: string, options?: Omit<LogOptions, 'prefix'>) =>
      info(message, { ...options, prefix }),
    warning: (message: string, options?: Omit<LogOptions, 'prefix'>) =>
      warning(message, { ...options, prefix }),
    error: (message: string, err?: any, options?: Omit<LogOptions, 'prefix'>) =>
      error(message, err, { ...options, prefix }),
    request: (method: string, path: string, options?: Omit<LogOptions, 'prefix'>) =>
      request(method, path, { ...options, prefix }),
  }
}

// ==================== 預設導出 ====================

export default {
  debug,
  info,
  warning,
  error,
  request,
  config,
  kv,
  jwt,
  subscription,
  notification,
  setMinLogLevel,
  createLogger,
  logRequestStart,
  logRequestEnd,
  logKvOperation,
}
