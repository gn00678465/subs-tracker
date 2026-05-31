import type { Subscription } from '../types'
import { describe, expect, it } from 'vitest'
import { toApiFormat, toFormFormat } from './formAdaptor'

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) {
    fd.append(k, v)
  }
  return fd
}

describe('toApiFormat', () => {
  it('maps basic string fields and trims to undefined when blank', () => {
    const fd = makeFormData({
      name: '  Netflix  ',
      customType: '',
      category: 'Streaming',
      currency: 'TWD',
      price: '390',
      periodValue: '1',
      periodUnit: 'month',
      periodMethod: 'credit',
      expiryDate: '2024-12-20',
    })

    const result = toApiFormat(fd)

    expect(result.name).toBe('Netflix')
    expect(result.customType).toBeUndefined()
    expect(result.category).toBe('Streaming')
    expect(result.periodValue).toBe(1)
    expect(result.periodUnit).toBe('month')
    expect(result.periodMethod).toBe('credit')
  })

  it('adds one day to expiryDate and returns ISO string', () => {
    const fd = makeFormData({ name: 'X', expiryDate: '2024-12-20' })
    const result = toApiFormat(fd)
    // +1 天
    expect(result.expiryDate?.startsWith('2024-12-21')).toBe(true)
  })

  it('converts checkbox "on" to true and absence to false', () => {
    const fd = makeFormData({ name: 'X', expiryDate: '2024-12-20', isActive: 'on' })
    const result = toApiFormat(fd)
    expect(result.isActive).toBe(true)
    expect(result.autoRenew).toBe(false)
    expect(result.isFreeTrial).toBe(false)
    expect(result.isReminderSet).toBe(false)
  })

  it('parses periodValue and reminderMe as numbers, undefined when invalid', () => {
    const fd = makeFormData({ name: 'X', expiryDate: '2024-12-20', periodValue: 'abc', reminderMe: '7' })
    const result = toApiFormat(fd)
    expect(result.periodValue).toBeUndefined()
    expect(result.reminderMe).toBe(7)
  })
})

describe('toFormFormat', () => {
  const base: Subscription = {
    id: 'sub_1',
    name: 'Netflix',
    expiryDate: '2024-12-21T00:00:00.000Z',
    autoRenew: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  it('subtracts one day from stored expiryDate for display', () => {
    const result = toFormFormat(base)
    expect(result.expiryDate).toBe('2024-12-20')
  })

  it('applies sensible defaults for optional fields', () => {
    const result = toFormFormat(base)
    expect(result.currency).toBe('TWD')
    expect(result.periodValue).toBe(1)
    expect(result.periodUnit).toBe('month')
    expect(result.periodMethod).toBe('credit')
    expect(result.reminderMe).toBe(1)
  })

  it('treats explicit false flags correctly', () => {
    const result = toFormFormat({ ...base, isActive: false, autoRenew: false, isFreeTrial: true, isReminderSet: false })
    expect(result.isActive).toBe(false)
    expect(result.autoRenew).toBe(false)
    expect(result.isFreeTrial).toBe(true)
    expect(result.isReminderSet).toBe(false)
  })

  it('round-trips periodMethod without losing the union type', () => {
    const result = toFormFormat({ ...base, periodMethod: 'paypal' })
    expect(result.periodMethod).toBe('paypal')
  })
})
