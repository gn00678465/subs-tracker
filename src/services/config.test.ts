import type { Config } from '../types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDateParts } from '../utils/time'
import { getCurrentHour } from './config'

function makeConfig(timezone: string): Config {
  return {
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'password',
    JWT_SECRET: 'secret',
    TIMEZONE: timezone,
    NOTIFICATION_HOURS: [],
    ENABLED_NOTIFIERS: [],
  }
}

describe('getCurrentHour', () => {
  // 2026-05-30T18:30:00Z：UTC 為 18 點，Asia/Taipei (UTC+8) 為隔日 02 點
  const fixedDate = new Date('2026-05-30T18:30:00.000Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(fixedDate)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the UTC hour when TIMEZONE is UTC', () => {
    expect(getCurrentHour(makeConfig('UTC'))).toBe(18)
  })

  it('returns the Asia/Taipei hour (UTC+8) for the same instant', () => {
    expect(getCurrentHour(makeConfig('Asia/Taipei'))).toBe(2)
  })

  it('differs between UTC and Asia/Taipei for the same instant', () => {
    const utcHour = getCurrentHour(makeConfig('UTC'))
    const taipeiHour = getCurrentHour(makeConfig('Asia/Taipei'))
    expect(utcHour).not.toBe(taipeiHour)
  })

  it('is consistent with getDateParts on the underlying clock', () => {
    const config = makeConfig('America/New_York')
    expect(getCurrentHour(config)).toBe(getDateParts(new Date(), config.TIMEZONE).hour)
  })
})
