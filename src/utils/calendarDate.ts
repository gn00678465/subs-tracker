/** 不含時間與時區的日曆日期，格式 YYYY-MM-DD */
export type CalendarDate = string

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function isCalendarDate(value: unknown): value is CalendarDate {
  if (typeof value !== 'string') return false
  const match = CALENDAR_DATE_PATTERN.exec(value)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function toParts(date: CalendarDate): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number)
  return [y, m, d]
}

function fromUTC(ms: number): CalendarDate {
  return new Date(ms).toISOString().slice(0, 10)
}

function datePartsIn(date: Date, timezone: string): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') }
}

export function todayIn(timezone: string, now = new Date()): CalendarDate {
  const { year, month, day } = datePartsIn(now, timezone)
  return fromUTC(Date.UTC(year, month - 1, day))
}

export function hourIn(timezone: string, now = new Date()): number {
  return datePartsIn(now, timezone).hour
}

export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  const [fy, fm, fd] = toParts(from)
  const [ty, tm, td] = toParts(to)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

// 月底日期會截到目標月份的最後一天，例如 01-31 加一個月是 02-28
export function addPeriod(date: CalendarDate, value: number, unit: 'day' | 'week' | 'month' | 'year'): CalendarDate {
  const [y, m, d] = toParts(date)
  if (unit === 'day') return fromUTC(Date.UTC(y, m - 1, d + value))
  if (unit === 'week') return fromUTC(Date.UTC(y, m - 1, d + value * 7))

  const months = unit === 'year' ? value * 12 : value
  const monthIndex = y * 12 + (m - 1) + months
  const ny = Math.floor(monthIndex / 12)
  const nm = monthIndex % 12
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate()
  return fromUTC(Date.UTC(ny, nm, Math.min(d, lastDay)))
}
