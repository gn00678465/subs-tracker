import { describe, expect, test } from 'bun:test'

import { addPeriod, daysBetween, hourIn, isCalendarDate, todayIn } from './calendarDate'

describe('calendarDate', () => {
  test('isCalendarDate rejects impossible dates', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true)
    expect(isCalendarDate('2026-02-30')).toBe(false)
    expect(isCalendarDate('2026-02-28T00:00:00.000Z')).toBe(false)
  })

  test('addPeriod clamps month ends', () => {
    expect(addPeriod('2026-01-31', 1, 'month')).toBe('2026-02-28')
    expect(addPeriod('2024-01-31', 1, 'month')).toBe('2024-02-29')
    expect(addPeriod('2026-12-15', 1, 'month')).toBe('2027-01-15')
    expect(addPeriod('2024-02-29', 1, 'year')).toBe('2025-02-28')
    expect(addPeriod('2026-01-30', 3, 'day')).toBe('2026-02-02')
    expect(addPeriod('2026-12-29', 1, 'week')).toBe('2027-01-05')
  })

  test('daysBetween counts calendar days', () => {
    expect(daysBetween('2026-09-26', '2026-10-01')).toBe(5)
    expect(daysBetween('2026-10-01', '2026-09-26')).toBe(-5)
  })

  test('todayIn and hourIn follow the timezone', () => {
    const instant = new Date('2026-09-26T17:00:00Z')
    expect(todayIn('Asia/Taipei', instant)).toBe('2026-09-27')
    expect(todayIn('America/Los_Angeles', instant)).toBe('2026-09-26')
    expect(hourIn('Asia/Taipei', new Date('2026-09-26T00:30:00Z'))).toBe(8)
    expect(hourIn('UTC', new Date('2026-09-26T00:30:00Z'))).toBe(0)
  })
})
