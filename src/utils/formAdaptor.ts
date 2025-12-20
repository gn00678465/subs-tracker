import type { Subscription } from '../types'

// ============ Type Definitions ============

/** 表單數據結構 */
export interface FormValues {
  // Identity
  id?: string

  // Basic Info
  name: string
  customType?: string
  category?: string

  // Pricing
  currency?: string
  price?: string
  isFreeTrial: boolean

  // Dates (YYYY-MM-DD format, -1 day offset from storage)
  startDate?: string
  expiryDate: string

  // Period Settings
  periodValue: number
  periodUnit: 'day' | 'month' | 'year'
  periodMethod?: string

  // Reminders
  isReminderSet: boolean
  reminderMe?: number

  // Other
  website?: string
  notes?: string

  // Flags
  isActive: boolean
  autoRenew: boolean
}

type FormDataRecord = Record<string, FormDataEntryValue>

// ============ Date Utilities ============

/**
 * 將 YYYY-MM-DD 格式的日期字符串 +1 天
 * @example addDayToDate('2024-12-20') → '2024-12-21T00:00:00.000Z'
 */
function addDayToDate(dateStr: string): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + 1)
  return date.toISOString()
}

/**
 * 將 ISO 日期字符串 -1 天並返回 YYYY-MM-DD 格式
 * @example subtractDayFromDate('2024-12-21T00:00:00.000Z') → '2024-12-20'
 */
function subtractDayFromDate(isoStr: string): string {
  const date = new Date(isoStr)
  date.setDate(date.getDate() - 1)
  return date.toISOString().split('T')[0]
}

/**
 * 將 ISO 日期字符串轉換為 YYYY-MM-DD 格式
 */
function toFormDateString(isoStr: string): string {
  return isoStr.split('T')[0]
}

// ============ Field Transformers ============

/**
 * 規範化字符串：trim 並將空字符串轉為 undefined
 */
function normalizeString(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

/**
 * 解析數字字符串
 */
function parseNumber(value: unknown): number | undefined {
  if (!value)
    return undefined
  const num = Number.parseInt(String(value))
  return Number.isNaN(num) ? undefined : num
}

/**
 * Checkbox 轉換：'on' → true, 其他 → false
 */
function checkboxToBoolean(value: unknown): boolean {
  return value === 'on'
}

// ============ Primary Adapters ============

/**
 * 將表單數據轉換為 API 格式
 * @param formData - HTML FormData 對象
 * @returns API 所需的 Subscription 部分字段
 */
export function toApiFormat(formData: FormData): Partial<Subscription> {
  const raw = Object.fromEntries(formData.entries()) as FormDataRecord

  // 處理到期日期：選定日期 +1 天作為實際過期時間
  const expiryDateInput = raw.expiryDate as string
  const expiryDateISO = addDayToDate(expiryDateInput)

  return {
    name: normalizeString(raw.name),
    customType: normalizeString(raw.customType),
    category: normalizeString(raw.category),
    currency: normalizeString(raw.currency),
    price: normalizeString(raw.price),
    startDate: normalizeString(raw.startDate),
    expiryDate: expiryDateISO,
    periodValue: parseNumber(raw.periodValue),
    periodUnit: raw.periodUnit as 'day' | 'month' | 'year',
    periodMethod: normalizeString(raw.periodMethod) as any,
    website: normalizeString(raw.website),
    reminderMe: parseNumber(raw.reminderMe),
    notes: normalizeString(raw.notes),

    // Checkbox fields
    isActive: checkboxToBoolean(raw.isActive),
    autoRenew: checkboxToBoolean(raw.autoRenew),
    isFreeTrial: checkboxToBoolean(raw.isFreeTrial),
    isReminderSet: checkboxToBoolean(raw.isReminderSet),
  }
}

/**
 * 將 API 數據轉換為表單格式
 * @param subscription - Subscription 對象
 * @returns 表單可用的數據對象
 */
export function toFormFormat(subscription: Subscription): FormValues {
  // 處理到期日期：儲存的是實際過期時間（選定日期+1），顯示時需要-1天
  const displayExpiryDate = subtractDayFromDate(subscription.expiryDate)

  return {
    id: subscription.id,
    name: subscription.name,
    customType: subscription.customType || '',
    category: subscription.category || '',
    currency: subscription.currency || 'TWD',
    price: subscription.price || '',
    startDate: subscription.startDate ? toFormDateString(subscription.startDate) : '',
    expiryDate: displayExpiryDate,
    periodValue: subscription.periodValue || 1,
    periodUnit: subscription.periodUnit || 'month',
    periodMethod: subscription.periodMethod || 'credit',
    website: subscription.website || '',
    reminderMe: subscription.reminderMe || 1,
    notes: subscription.notes || '',

    // Boolean fields with defaults
    isActive: subscription.isActive !== false,
    autoRenew: subscription.autoRenew !== false,
    isFreeTrial: subscription.isFreeTrial === true,
    isReminderSet: subscription.isReminderSet !== false,
  }
}
