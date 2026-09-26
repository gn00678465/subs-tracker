import { describe, expect, test } from 'bun:test'

import { applyAutoRenewal, normalizeStoredSubscription } from '../services/subscription'
import type { Subscription } from '../types'
import { addPeriod, daysBetween, hourIn, isCalendarDate, todayIn } from './calendarDate'

const base: Subscription = {
  id: '1',
  name: 'Netflix',
  expiryDate: '2026-08-31',
  autoRenew: true,
  isActive: true,
  periodValue: 1,
  periodUnit: 'month',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

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

describe('subscription storage', () => {
  test('legacy expiry timestamps become the selected date', () => {
    const migrated = normalizeStoredSubscription({
      ...base,
      expiryDate: '2024-12-21T00:00:00.000Z',
      startDate: '2024-01-05T00:00:00.000Z',
      lastCheckedExpiryDate: '2024-12-21T00:00:00.000Z',
      category: '',
      customType: '串流媒體',
    })
    expect(migrated.expiryDate).toBe('2024-12-20')
    expect(migrated.startDate).toBe('2024-01-05')
    expect(migrated.lastCheckedExpiryDate).toBe('2024-12-20')
    expect(migrated.category).toBe('串流媒體')
    expect('customType' in migrated).toBe(false)
  })

  test('current records pass through unchanged', () => {
    expect(normalizeStoredSubscription({ ...base, category: '影音' })).toEqual({
      ...base,
      category: '影音',
      startDate: undefined,
      lastCheckedExpiryDate: undefined,
    })
  })

  test('auto renewal moves a past date to the first date on or after today', () => {
    expect(applyAutoRenewal(base, '2026-09-26')).toEqual({ renewed: true, newExpiryDate: '2026-09-30' })
    expect(applyAutoRenewal(base, '2026-08-31')).toEqual({ renewed: false })
    expect(applyAutoRenewal({ ...base, autoRenew: false }, '2026-09-26')).toEqual({ renewed: false })
  })
})
