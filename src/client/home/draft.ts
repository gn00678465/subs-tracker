import type { PeriodUnit, ReminderSetting, Subscription } from '../../types'
import type { CalendarDate } from '../../utils/calendarDate'

/** 表單的值；輸入框的值都是字串，儲存前才轉型 */
export interface Draft {
  name: string
  currency: string
  price: string
  periodValue: string
  periodUnit: PeriodUnit
  expiryDate: string
  autoRenew: boolean
  isFreeTrial: boolean
  /** 'default'、'off' 或天數 */
  reminder: string
  cancelByDate: string
  category: string
  paymentMethod: string
  website: string
  startDate: string
  notes: string
}

export type DraftField = keyof Draft
export type DraftErrors = Partial<Record<DraftField, string>>

export const CURRENCIES = [
  'TWD',
  'USD',
  'JPY',
  'EUR',
  'HKD',
  'CNY',
  'GBP',
  'KRW',
  'SGD',
  'AUD',
  'CAD',
  'CHF',
  'SEK',
  'NZD',
]

export function emptyDraft(currency: string): Draft {
  return {
    name: '',
    currency,
    price: '',
    periodValue: '1',
    periodUnit: 'month',
    expiryDate: '',
    autoRenew: true,
    isFreeTrial: false,
    reminder: 'default',
    cancelByDate: '',
    category: '',
    paymentMethod: '',
    website: '',
    startDate: '',
    notes: '',
  }
}

export function draftOf(sub: Subscription): Draft {
  return {
    name: sub.name,
    currency: sub.currency,
    price: String(sub.price),
    periodValue: String(sub.periodValue),
    periodUnit: sub.periodUnit,
    expiryDate: sub.expiryDate,
    autoRenew: sub.autoRenew,
    isFreeTrial: sub.isFreeTrial,
    reminder: String(sub.reminder),
    cancelByDate: sub.cancelByDate ?? '',
    category: sub.category,
    paymentMethod: sub.paymentMethod,
    website: sub.website,
    startDate: sub.startDate ?? '',
    notes: sub.notes,
  }
}

/** 新增時貨幣預選最近一次新增的訂閱用的貨幣 */
export function lastCurrency(subs: Subscription[]): string {
  const latest = subs.reduce<Subscription | null>(
    (found, sub) => (!found || sub.createdAt > found.createdAt ? sub : found),
    null,
  )
  return latest?.currency ?? 'TWD'
}

const parsePrice = (price: string) => (/^\d+(\.\d+)?$/.test(price.trim()) ? Number(price) : null)

export function validate(draft: Draft): DraftErrors {
  const errors: DraftErrors = {}
  if (!draft.name.trim()) errors.name = '請輸入名稱'
  if (!draft.price.trim()) errors.price = '請輸入金額'
  else if (parsePrice(draft.price) === null) errors.price = '請輸入數字，例如 390'
  if (!/^[1-9]\d{0,2}$/.test(draft.periodValue.trim())) errors.periodValue = '請輸入 1 到 999 的整數'
  if (!draft.expiryDate) errors.expiryDate = `請選擇${draft.isFreeTrial ? '試用結束日' : '下次扣款日'}`
  if (draft.website.trim() && !/^https?:\/\/\S+$/i.test(draft.website.trim())) {
    errors.website = '網址要以 http:// 或 https:// 開頭'
  }
  return errors
}

function reminderOf(value: string): ReminderSetting {
  return value === 'default' || value === 'off' ? value : Number(value)
}

/** 送給 API 的內容；清空的選填日期送 null，伺服器才會清除 */
export function toRequest(draft: Draft) {
  const optionalDate = (value: string): CalendarDate | null => value || null
  return {
    name: draft.name.trim(),
    currency: draft.currency,
    price: parsePrice(draft.price) ?? 0,
    periodValue: Number(draft.periodValue),
    periodUnit: draft.periodUnit,
    expiryDate: draft.expiryDate,
    autoRenew: draft.autoRenew,
    isFreeTrial: draft.isFreeTrial,
    reminder: reminderOf(draft.reminder),
    cancelByDate: optionalDate(draft.cancelByDate),
    category: draft.category.trim(),
    paymentMethod: draft.paymentMethod.trim(),
    website: draft.website.trim(),
    startDate: optionalDate(draft.startDate),
    notes: draft.notes,
  }
}

/** 還沒儲存的卡片，給表單上方的預覽使用 */
export function previewOf(draft: Draft, today: CalendarDate): Subscription {
  const request = toRequest(draft)
  return {
    ...request,
    id: 'preview',
    name: request.name || '新的訂閱',
    periodValue: request.periodValue || 1,
    expiryDate: draft.expiryDate || today,
    cancelByDate: request.cancelByDate ?? undefined,
    startDate: request.startDate ?? undefined,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  }
}
