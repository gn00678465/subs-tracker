import { useEffect, useRef, useState } from 'hono/jsx'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide'

import { Icon } from '../../components/Icon'
import type { CalendarDate } from '../../utils/calendarDate'
import { addPeriod } from '../../utils/calendarDate'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const YEARS_BACK = 30
const YEARS_AHEAD = 10

const pad = (n: number) => String(n).padStart(2, '0')
const partsOf = (date: CalendarDate) => date.split('-').map(Number) as [number, number, number]
const weekdayOf = (date: CalendarDate) => {
  const [y, m, d] = partsOf(date)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

export function longDate(date: CalendarDate): string {
  const [y, m, d] = partsOf(date)
  return `${y} 年 ${m} 月 ${d} 日（${WEEKDAYS[weekdayOf(date)]}）`
}

// 固定 6 週，換月時月曆高度不變
function weeksOf(year: number, month: number): CalendarDate[][] {
  const first = `${year}-${pad(month)}-01`
  const start = addPeriod(first, -weekdayOf(first), 'day')
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addPeriod(start, week * 7 + day, 'day')),
  )
}

// 鍵盤操作依 WAI-ARIA APG 的 date picker dialog
function keyTarget(event: KeyboardEvent, date: CalendarDate): CalendarDate | null {
  const unit = event.shiftKey ? 'year' : 'month'
  switch (event.key) {
    case 'ArrowLeft':
      return addPeriod(date, -1, 'day')
    case 'ArrowRight':
      return addPeriod(date, 1, 'day')
    case 'ArrowUp':
      return addPeriod(date, -1, 'week')
    case 'ArrowDown':
      return addPeriod(date, 1, 'week')
    case 'Home':
      return addPeriod(date, -weekdayOf(date), 'day')
    case 'End':
      return addPeriod(date, 6 - weekdayOf(date), 'day')
    case 'PageUp':
      return addPeriod(date, -1, unit)
    case 'PageDown':
      return addPeriod(date, 1, unit)
    default:
      return null
  }
}

interface DatePickerProps {
  id: string
  name: string
  label: string
  value: CalendarDate
  today: CalendarDate
  optional?: boolean
  invalid?: Record<string, string | undefined>
  onChange: (value: CalendarDate) => void
}

export const DatePicker = ({ id, name, label, value, today, optional, invalid, onChange }: DatePickerProps) => {
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState<CalendarDate>(value || today)
  const root = useRef<HTMLDivElement>(null)
  // 要移過去的日期。換月時 hono/jsx 會依位置重用按鈕，按鈕上的日期會變，所以不能從按鈕讀
  const pending = useRef<CalendarDate | null>(null)
  const [year, month] = partsOf(focus)

  useEffect(() => {
    const day = open && pending.current && root.current?.querySelector<HTMLElement>(`[data-date="${pending.current}"]`)
    if (!day) return
    pending.current = null
    root.current?.querySelector('.calendar')?.scrollIntoView({ block: 'nearest' })
    day.focus({ preventScroll: true })
  }, [open, focus])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const trigger = () => root.current?.querySelector<HTMLElement>('.date-trigger')
  const show = () => {
    pending.current = value || today
    setFocus(value || today)
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    trigger()?.focus()
  }
  const pick = (date: CalendarDate) => {
    onChange(date)
    close()
  }
  const shiftMonth = (months: number) => setFocus(addPeriod(focus, months, 'month'))
  const jumpTo = (y: number, m: number) => setFocus(addPeriod(focus, (y - year) * 12 + (m - month), 'month'))

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !open) return
    // 不讓表單的 Esc 處理關掉整個表單
    event.stopPropagation()
    close()
  }
  const onGridKey = (event: KeyboardEvent) => {
    // 連續按鍵時，前一個按鍵的焦點可能還沒移過去，從 pending 接著算
    const from = pending.current ?? focus
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      return pick(from)
    }
    const next = keyTarget(event, from)
    if (!next) return
    event.preventDefault()
    pending.current = next
    setFocus(next)
  }

  const [todayYear] = partsOf(today)
  const firstYear = Math.min(todayYear - YEARS_BACK, year)
  const lastYear = Math.max(todayYear + YEARS_AHEAD, year)
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i)

  return (
    <div class="date-picker" ref={root} onKeyDown={onKeyDown}>
      <button
        class="input date-trigger"
        type="button"
        id={id}
        name={name}
        aria-label={`${label}：${value ? longDate(value) : '未選擇'}`}
        aria-haspopup="dialog"
        aria-expanded={String(open)}
        onClick={() => (open ? setOpen(false) : show())}
        {...invalid}
      >
        {value ? <span class="num">{longDate(value)}</span> : <span class="placeholder">選擇日期</span>}
        <Icon node={Calendar} />
      </button>
      {open && (
        <div class="calendar" role="dialog" aria-label={`選擇${label}`}>
          <div class="cal-head">
            <button class="cal-nav" type="button" aria-label="上個月" onClick={() => shiftMonth(-1)}>
              <Icon node={ChevronLeft} />
            </button>
            <div class="cal-caption">
              <select
                aria-label="年"
                onChange={(event: Event) => jumpTo(Number((event.target as HTMLSelectElement).value), month)}
              >
                {years.map((y) => (
                  <option value={y} selected={y === year}>
                    {y} 年
                  </option>
                ))}
              </select>
              <select
                aria-label="月"
                onChange={(event: Event) => jumpTo(year, Number((event.target as HTMLSelectElement).value))}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option value={i + 1} selected={i + 1 === month}>
                    {i + 1} 月
                  </option>
                ))}
              </select>
            </div>
            <button class="cal-nav" type="button" aria-label="下個月" onClick={() => shiftMonth(1)}>
              <Icon node={ChevronRight} />
            </button>
          </div>
          <span class="sr-only" id={`${id}-month`} aria-live="polite">
            {`${year} 年 ${month} 月`}
          </span>
          <table class="cal-grid" role="grid" aria-labelledby={`${id}-month`} onKeyDown={onGridKey}>
            <thead>
              <tr>
                {WEEKDAYS.map((day) => (
                  <th scope="col" abbr={`星期${day}`}>
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeksOf(year, month).map((week) => (
                <tr>
                  {week.map((date) => (
                    <td aria-selected={String(date === value)}>
                      <button
                        class="cal-day num"
                        type="button"
                        data-date={date}
                        data-outside={partsOf(date)[1] !== month ? '' : undefined}
                        aria-current={date === today ? 'date' : undefined}
                        aria-label={longDate(date)}
                        tabindex={date === focus ? 0 : -1}
                        onClick={() => pick(date)}
                      >
                        {partsOf(date)[2]}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div class="cal-foot">
            <button type="button" onClick={() => pick(today)}>
              今天
            </button>
            {optional && value && (
              <button type="button" class="clear" onClick={() => pick('')}>
                清除
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
