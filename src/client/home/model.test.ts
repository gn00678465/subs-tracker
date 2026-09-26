import { expect, test } from 'bun:test'

import type { Subscription } from '../../types'
import { groupSubscriptions, isPaying, money, perYear, statusOf, totalsBy, whenText } from './model'

const TODAY = '2026-09-26'

function sub(overrides: Partial<Subscription>): Subscription {
  return {
    id: overrides.name ?? 'x',
    name: 'x',
    category: '',
    currency: 'TWD',
    price: 100,
    periodValue: 1,
    periodUnit: 'month',
    expiryDate: '2026-10-01',
    autoRenew: true,
    isFreeTrial: false,
    reminder: 'default',
    paymentMethod: '',
    website: '',
    notes: '',
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

test('cards fall into groups by days until the next charge', () => {
  const groups = groupSubscriptions(
    [
      sub({ name: 'later', expiryDate: '2026-11-20' }),
      sub({ name: 'due', expiryDate: '2026-09-20', autoRenew: false }),
      sub({ name: 'week', expiryDate: '2026-10-03' }),
      sub({ name: 'today', expiryDate: '2026-09-26' }),
      sub({ name: 'month', expiryDate: '2026-10-26' }),
      sub({ name: 'paused', expiryDate: '2026-09-01', isActive: false }),
    ],
    TODAY,
    3,
  )
  const names = Object.fromEntries(Object.entries(groups).map(([key, list]) => [key, list.map((s) => s.name)]))
  expect(names).toEqual({
    due: ['due'],
    week: ['today', 'week'],
    month: ['month'],
    later: ['later'],
    paused: ['paused'],
  })
})

test('the countdown turns bold inside the reminder window, counted from the cancel-by date when set', () => {
  expect(statusOf(sub({ expiryDate: '2026-09-29' }), TODAY, 3).soon).toBe(true)
  expect(statusOf(sub({ expiryDate: '2026-09-30' }), TODAY, 3).soon).toBe(false)
  expect(statusOf(sub({ expiryDate: '2026-10-10', cancelByDate: '2026-09-28' }), TODAY, 3).soon).toBe(true)
  expect(statusOf(sub({ expiryDate: '2026-09-27', reminder: 'off' }), TODAY, 3).soon).toBe(false)
})

test('the lip shows a countdown within 30 days and a date after that', () => {
  expect(whenText(sub({ expiryDate: '2026-09-27' }), 1)).toBe('明天')
  expect(whenText(sub({ expiryDate: '2026-10-26' }), 30)).toBe('30 天後')
  expect(whenText(sub({ expiryDate: '2026-10-27' }), 31)).toBe('10/27')
})

test('spend averages exclude trials and paused subscriptions and stay per currency', () => {
  const subs = [
    sub({ price: 390 }),
    sub({ price: 60, periodUnit: 'week' }),
    sub({ price: 1490, periodUnit: 'year' }),
    sub({ price: 149, isFreeTrial: true }),
    sub({ price: 270, isActive: false }),
    sub({ currency: 'USD', price: 20 }),
    sub({ currency: 'EUR', price: 10, periodValue: 3 }),
  ]
  const monthly = totalsBy(subs.filter(isPaying), (s) => perYear(s) / 12)
  expect(monthly.map(([currency, value]) => [currency, money(currency, value)])).toEqual([
    ['TWD', '774'],
    ['EUR', '3.33'],
    ['USD', '20'],
  ])
})
