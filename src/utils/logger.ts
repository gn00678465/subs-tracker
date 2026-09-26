/**
 * 日誌格式：[時間] [級別] [前綴] 訊息
 */

type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'JWT' | 'NOTIFICATION'

interface LogOptions {
  prefix?: string
  data?: unknown
}

function log(level: LogLevel, message: string, options: LogOptions = {}): void {
  const prefix = options.prefix ? ` [${options.prefix}]` : ''
  const line = `[${new Date().toISOString()}] [${level}]${prefix} ${message}`
  const write = level === 'ERROR' ? console.error : level === 'WARNING' ? console.warn : console.log
  write(line, options.data || '')
}

export function info(message: string, options?: LogOptions): void {
  log('INFO', message, options)
}

export function warning(message: string, options?: LogOptions): void {
  log('WARNING', message, options)
}

export function error(message: string, error?: unknown, options?: LogOptions): void {
  const data = error instanceof Error ? { message: error.message, stack: error.stack } : error
  log('ERROR', message, { ...options, data })
}

export function jwt(message: string, options?: LogOptions): void {
  log('JWT', message, options)
}

export function notification(message: string, options?: LogOptions): void {
  log('NOTIFICATION', message, options)
}
