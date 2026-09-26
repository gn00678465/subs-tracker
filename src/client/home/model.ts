import type { PeriodUnit, Subscription } from '../../types'
import { daysBetween } from '../../utils/calendarDate'
import type { CalendarDate } from '../../utils/calendarDate'

export type Group = 'due' | 'week' | 'month' | 'later' | 'paused'

export const GROUPS: Group[] = ['due', 'week', 'month', 'later', 'paused']

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const UNIT_LABEL: Record<PeriodUnit, string> = { day: '天', week: '週', month: '月', year: '年' }
const PER_YEAR: Record<PeriodUnit, number> = { day: 365, week: 52, month: 12, year: 1 }
const NO_DECIMALS = new Set(['TWD', 'JPY', 'KRW'])

export function reminderDays(sub: Subscription, defaultDays: number): number | null {
  if (sub.reminder === 'off') return null
  return sub.reminder === 'default' ? defaultDays : sub.reminder
}

export interface CardStatus {
  days: number
  /** 在提醒天數內，倒數改成粗體 */
  soon: boolean
  group: Group
}

export function statusOf(sub: Subscription, today: CalendarDate, defaultDays: number): CardStatus {
  const days = daysBetween(today, sub.expiryDate)
  const reminder = reminderDays(sub, defaultDays)
  const anchor = sub.cancelByDate ?? sub.expiryDate
  const soon = reminder !== null && days >= 0 && daysBetween(today, anchor) <= reminder
  let group: Group = 'later'
  if (!sub.isActive) group = 'paused'
  else if (days < 0) group = 'due'
  else if (days <= 7) group = 'week'
  else if (days <= 30) group = 'month'
  return { days, soon, group }
}

export function groupSubscriptions(
  subs: Subscription[],
  today: CalendarDate,
  defaultDays: number,
): Record<Group, Subscription[]> {
  const groups: Record<Group, Subscription[]> = { due: [], week: [], month: [], later: [], paused: [] }
  const sorted = [...subs].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
  for (const sub of sorted) groups[statusOf(sub, today, defaultDays).group].push(sub)
  return groups
}

export function perYear(sub: Subscription): number {
  return (sub.price * PER_YEAR[sub.periodUnit]) / sub.periodValue
}

/** 依貨幣加總；TWD 排第一，其餘依代碼排序 */
export function totalsBy(subs: Subscription[], amount: (sub: Subscription) => number): [string, number][] {
  const totals = new Map<string, number>()
  for (const sub of subs) totals.set(sub.currency, (totals.get(sub.currency) ?? 0) + amount(sub))
  return [...totals].sort(([a], [b]) => (a === 'TWD' ? -1 : b === 'TWD' ? 1 : a.localeCompare(b)))
}

/** 花費只算使用中、非試用的訂閱 */
export function isPaying(sub: Subscription): boolean {
  return sub.isActive && !sub.isFreeTrial
}

export function money(currency: string, value: number): string {
  const rounded = Math.round(value * 100) / 100
  const digits = NO_DECIMALS.has(currency) || Number.isInteger(rounded) ? 0 : 2
  return rounded.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function periodText(sub: Pick<Subscription, 'periodValue' | 'periodUnit'>): string {
  const unit = UNIT_LABEL[sub.periodUnit]
  return sub.periodValue === 1 ? `/${unit}` : `/${sub.periodValue} ${unit}`
}

export function monthDay(date: CalendarDate): string {
  const [, m, d] = date.split('-').map(Number)
  return `${m}/${d}`
}

export function monthDayWeekday(date: CalendarDate): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${m}/${d}（${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`
}

export function countdownText(days: number): string {
  if (days < 0) return `過期 ${-days} 天`
  if (days === 0) return '今天'
  if (days === 1) return '明天'
  return `${days} 天後`
}

/** 卡緣的扣款時間：30 天內顯示倒數，更遠的顯示日期 */
export function whenText(sub: Subscription, days: number): string {
  return days > 30 ? monthDay(sub.expiryDate) : countdownText(days)
}

export function matchesQuery(sub: Subscription, query: string, category: string): boolean {
  if (category && sub.category !== category) return false
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [sub.name, sub.category, sub.paymentMethod, sub.notes].join(' ').toLowerCase().includes(q)
}

const CATEGORY_TONE: Record<string, string> = {
  影音: 'plum',
  音樂: 'green',
  雲端: 'blue',
  工具: 'teal',
  遊戲: 'ochre',
  設計: 'brick',
  學習: 'violet',
  新聞: 'slate',
}
const TONES = ['green', 'blue', 'brick', 'violet', 'ochre', 'slate', 'teal', 'plum']

/** 分類是自由輸入；沒有對照的分類依名稱固定分到一種顏色 */
export function tone(category: string): string {
  if (!category) return 'var(--c-slate)'
  const known = CATEGORY_TONE[category]
  if (known) return `var(--c-${known})`
  let hash = 0
  for (const char of category) hash = (hash * 31 + char.codePointAt(0)!) >>> 0
  return `var(--c-${TONES[hash % TONES.length]})`
}
