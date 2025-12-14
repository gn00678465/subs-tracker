/**
 * 時區工具模組 - 使用原生 Intl API
 * 適用於 Cloudflare Workers 環境，無需額外依賴
 */

import * as logger from './logger'

// 常量
export const MS_PER_HOUR = 1000 * 60 * 60
export const MS_PER_DAY = MS_PER_HOUR * 24

// 預設語系
export const DEFAULT_LOCALE = 'zh-TW'

// 時區名稱映射（繁體中文）
export const TIMEZONE_NAMES: Record<string, string> = {
  'UTC': '世界標準時間',
  'Asia/Shanghai': '中國標準時間',
  'Asia/Hong_Kong': '香港時間',
  'Asia/Taipei': '台北時間',
  'Asia/Singapore': '新加坡時間',
  'Asia/Tokyo': '日本時間',
  'Asia/Seoul': '韓國時間',
  'America/New_York': '美國東部時間',
  'America/Los_Angeles': '美國太平洋時間',
  'America/Chicago': '美國中部時間',
  'America/Denver': '美國山地時間',
  'Europe/London': '英國時間',
  'Europe/Paris': '巴黎時間',
  'Europe/Berlin': '柏林時間',
  'Europe/Moscow': '莫斯科時間',
  'Australia/Sydney': '雪梨時間',
  'Australia/Melbourne': '墨爾本時間',
  'Pacific/Auckland': '奧克蘭時間',
}

interface DateParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/**
 * 驗證時區是否有效
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    new Date().toLocaleString('en-US', { timeZone: timezone })
    return true
  }
  catch {
    return false
  }
}

/**
 * 獲取指定時區的日期各部分
 */
export function getDateParts(date: Date, timezone = 'UTC'): DateParts {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const parts = formatter.formatToParts(date)
    const getValue = (type: Intl.DateTimeFormatPartTypes): number => {
      const part = parts.find(p => p.type === type)
      return part ? Number(part.value) : 0
    }

    return {
      year: getValue('year'),
      month: getValue('month'),
      day: getValue('day'),
      hour: getValue('hour'),
      minute: getValue('minute'),
      second: getValue('second'),
    }
  }
  catch (error) {
    // Fallback to UTC
    logger.error(`Failed to parse timezone ${timezone}`, error)
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
    }
  }
}

/**
 * 格式化時間為指定時區
 * @param time - Date 對象或時間戳
 * @param timezone - IANA 時區名稱
 * @param format - 'date' | 'datetime' | 'full'
 * @param locale - 語系，預設為 zh-TW
 */
export function formatTime(
  time: Date | number | string,
  timezone = 'UTC',
  format: 'date' | 'datetime' | 'full' = 'full',
  locale = DEFAULT_LOCALE,
): string {
  try {
    const date = typeof time === 'number' || typeof time === 'string' ? new Date(time) : time

    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }

    if (format === 'datetime' || format === 'full') {
      options.hour = '2-digit'
      options.minute = '2-digit'
      options.second = '2-digit'
      options.hour12 = false
    }

    return date.toLocaleString(locale, options)
  }
  catch (error) {
    logger.error('Time formatting error', error)
    return new Date(time).toISOString()
  }
}

/**
 * 獲取時區偏移量（小時）
 */
export function getTimezoneOffset(timezone = 'UTC'): number {
  try {
    const now = new Date()
    const parts = getDateParts(now, timezone)
    const zonedTimestamp = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    )
    return Math.round((zonedTimestamp - now.getTime()) / MS_PER_HOUR)
  }
  catch (error) {
    logger.error('Failed to get timezone offset', error)
    return 0
  }
}

/**
 * 格式化時區顯示（包含 UTC 偏移）
 */
export function formatTimezoneDisplay(timezone = 'UTC'): string {
  try {
    const offset = getTimezoneOffset(timezone)
    const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`
    const name = TIMEZONE_NAMES[timezone] || timezone
    return `${name} (UTC${offsetStr})`
  }
  catch (error) {
    logger.error('Failed to format timezone display', error)
    return timezone
  }
}

/**
 * 計算過期時間
 */
export function calculateExpirationTime(
  expirationMinutes: number,
  _timezone = 'UTC',
): Date {
  const now = new Date()
  return new Date(now.getTime() + expirationMinutes * 60 * 1000)
}

/**
 * 檢查是否已過期
 */
export function isExpired(targetTime: Date | string | number): boolean {
  const now = new Date()
  const target = new Date(targetTime)
  return now > target
}

/**
 * 獲取指定時區的午夜時間戳
 */
export function getMidnightTimestamp(date: Date, timezone = 'UTC'): number {
  const parts = getDateParts(date, timezone)
  return Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0)
}

/**
 * 從請求中提取時區
 * 優先級：URL 參數 > Header > Accept-Language > 默認值
 */
export function extractTimezoneFromRequest(request: Request): string {
  const url = new URL(request.url)

  // 1. URL 參數
  const timezoneParam = url.searchParams.get('timezone')
  if (timezoneParam && isValidTimezone(timezoneParam)) {
    return timezoneParam
  }

  // 2. 請求頭
  const timezoneHeader = request.headers.get('X-Timezone')
  if (timezoneHeader && isValidTimezone(timezoneHeader)) {
    return timezoneHeader
  }

  // 3. Accept-Language 推斷
  const acceptLanguage = request.headers.get('Accept-Language')
  if (acceptLanguage) {
    if (acceptLanguage.includes('zh-TW') || acceptLanguage.includes('zh-HK'))
      return 'Asia/Taipei'
    if (acceptLanguage.includes('zh'))
      return 'Asia/Shanghai'
    if (acceptLanguage.includes('en-US'))
      return 'America/New_York'
    if (acceptLanguage.includes('en-GB'))
      return 'Europe/London'
    if (acceptLanguage.includes('ja'))
      return 'Asia/Tokyo'
  }

  // 4. 默認值
  return 'UTC'
}

/**
 * 計算兩個日期之間的天數差異
 */
export function getDaysDifference(date1: Date, date2: Date, timezone = 'UTC'): number {
  const midnight1 = getMidnightTimestamp(date1, timezone)
  const midnight2 = getMidnightTimestamp(date2, timezone)
  return Math.ceil((midnight2 - midnight1) / MS_PER_DAY)
}

/**
 * 計算兩個日期之間的小時差異
 */
export function getHoursDifference(date1: Date, date2: Date): number {
  return Math.round((date2.getTime() - date1.getTime()) / MS_PER_HOUR)
}

/**
 * 增加指定天數
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * 增加指定月份
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

/**
 * 增加指定年份
 */
export function addYears(date: Date, years: number): Date {
  const result = new Date(date)
  result.setFullYear(result.getFullYear() + years)
  return result
}

/**
 * 根據週期單位增加時間
 */
export function addPeriod(
  date: Date,
  value: number,
  unit: 'day' | 'month' | 'year',
): Date {
  switch (unit) {
    case 'day':
      return addDays(date, value)
    case 'month':
      return addMonths(date, value)
    case 'year':
      return addYears(date, value)
    default:
      return date
  }
}

/**
 * 格式化為 ISO 8601 日期字串 (YYYY-MM-DD)
 */
export function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * 解析 ISO 日期字串為 Date 對象
 */
export function parseISODate(dateString: string): Date {
  return new Date(dateString)
}

/**
 * 獲取當前時間（可指定時區）
 */
export function getCurrentTime(timezone = 'UTC'): Date {
  return new Date()
}

/**
 * 檢查日期是否為今天
 */
export function isToday(date: Date, timezone = 'UTC'): boolean {
  const today = getCurrentTime(timezone)
  const todayMidnight = getMidnightTimestamp(today, timezone)
  const dateMidnight = getMidnightTimestamp(date, timezone)
  return todayMidnight === dateMidnight
}

/**
 * 檢查日期是否在未來
 */
export function isFuture(date: Date): boolean {
  return date.getTime() > Date.now()
}

/**
 * 檢查日期是否在過去
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now()
}
