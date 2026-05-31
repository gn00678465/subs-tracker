import type { Config, Subscription } from '../types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock notifier so processSubscriptionReminder never hits the network.
vi.mock('./notifier', () => ({
  sendSubscriptionReminder: vi.fn(),
}))

// Mock subscription so applyAutoRenewal is deterministic and isolated.
vi.mock('./subscription', () => ({
  applyAutoRenewal: vi.fn(),
}))

const { sendSubscriptionReminder } = await import('./notifier')
const { applyAutoRenewal } = await import('./subscription')
const { processSubscriptionReminder } = await import('./subscription_cron')

const sendMock = vi.mocked(sendSubscriptionReminder)
const renewalMock = vi.mocked(applyAutoRenewal)

function makeConfig(): Config {
  return {
    ADMIN_USERNAME: 'admin',
    ADMIN_PASSWORD: 'password',
    JWT_SECRET: 'secret',
    TIMEZONE: 'UTC',
    NOTIFICATION_HOURS: [],
    ENABLED_NOTIFIERS: ['telegram'],
    REMINDER_MODE: 'ONCE',
  }
}

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-1',
    name: 'Netflix',
    expiryDate: '2026-06-01T00:00:00.000Z',
    autoRenew: false,
    isActive: true,
    isReminderSet: true,
    reminderMe: 7,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const okResult = {
  totalChannels: 1,
  successCount: 1,
  failureCount: 0,
  results: [{ channel: 'telegram', success: true }],
}
const failResult = {
  totalChannels: 1,
  successCount: 0,
  failureCount: 1,
  results: [{ channel: 'telegram', success: false, error: 'boom' }],
}

// 固定「現在」為到期前 3 天，落在 reminderMe=7 的提醒窗口內。
const currentTime = new Date('2026-05-29T00:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  renewalMock.mockReturnValue({ renewed: false })
})

describe('processSubscriptionReminder', () => {
  it('skips inactive / unset subscriptions without sending', async () => {
    const sub = makeSubscription({ isActive: false })
    const result = await processSubscriptionReminder(sub, currentTime, makeConfig())
    expect(result.action).toBe('skipped')
    expect(result.success).toBe(true)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('reminds when in window and send succeeds', async () => {
    sendMock.mockResolvedValue(okResult)
    const sub = makeSubscription()
    const result = await processSubscriptionReminder(sub, currentTime, makeConfig())
    expect(result.action).toBe('reminded')
    expect(result.success).toBe(true)
    expect(result.updatedSubscription?.lastReminderSentAt).toBe(currentTime.toISOString())
    expect(result.updatedSubscription?.lastCheckedExpiryDate).toBe(sub.expiryDate)
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('reports reminded:false when send fails', async () => {
    sendMock.mockResolvedValue(failResult)
    const sub = makeSubscription()
    const result = await processSubscriptionReminder(sub, currentTime, makeConfig())
    expect(result.action).toBe('reminded')
    expect(result.success).toBe(false)
  })

  it('renews when expired and autoRenew, returning updatedSubscription', async () => {
    const newExpiry = '2026-06-29T00:00:00.000Z'
    renewalMock.mockReturnValue({ renewed: true, newExpiryDate: newExpiry })
    // 已過期：expiryDate 在 currentTime 之前
    const sub = makeSubscription({
      autoRenew: true,
      expiryDate: '2026-05-01T00:00:00.000Z',
    })
    const result = await processSubscriptionReminder(sub, currentTime, makeConfig())
    // 續期後新到期日距今約一個月，超出 reminderMe 窗口 → renewed 但不發送
    expect(result.action).toBe('renewed')
    expect(result.success).toBe(true)
    expect(result.updatedSubscription?.expiryDate).toBe(newExpiry)
    expect(result.updatedSubscription?.lastCheckedExpiryDate).toBe(newExpiry)
    expect(result.updatedSubscription?.lastReminderSentAt).toBeUndefined()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('does NOT mutate the input subscription (reminded path)', async () => {
    sendMock.mockResolvedValue(okResult)
    const sub = makeSubscription()
    const snapshot = structuredClone(sub)
    await processSubscriptionReminder(sub, currentTime, makeConfig())
    expect(sub).toEqual(snapshot)
  })

  it('does NOT mutate the input subscription (renewed path)', async () => {
    renewalMock.mockReturnValue({
      renewed: true,
      newExpiryDate: '2026-06-29T00:00:00.000Z',
    })
    const sub = makeSubscription({
      autoRenew: true,
      expiryDate: '2026-05-01T00:00:00.000Z',
    })
    const snapshot = structuredClone(sub)
    await processSubscriptionReminder(sub, currentTime, makeConfig())
    expect(sub).toEqual(snapshot)
  })

  it('skips without sending when not in the reminder window', async () => {
    const sub = makeSubscription({ expiryDate: '2026-08-01T00:00:00.000Z' })
    const result = await processSubscriptionReminder(sub, currentTime, makeConfig())
    expect(result.action).toBe('skipped')
    expect(result.updatedSubscription).toBeUndefined()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('reminds when the expiry date changed since the last check (manual renewal)', async () => {
    sendMock.mockResolvedValue(okResult)
    const sub = makeSubscription({
      lastReminderSentAt: '2026-05-20T00:00:00.000Z',
      lastCheckedExpiryDate: '2026-05-15T00:00:00.000Z',
    })
    const result = await processSubscriptionReminder(sub, currentTime, makeConfig())
    expect(result.action).toBe('reminded')
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('skips in ONCE mode when a reminder was already sent', async () => {
    const sub = makeSubscription({
      lastReminderSentAt: '2026-05-20T00:00:00.000Z',
      lastCheckedExpiryDate: '2026-06-01T00:00:00.000Z',
    })
    const result = await processSubscriptionReminder(sub, currentTime, makeConfig())
    expect(result.action).toBe('skipped')
    expect(result.updatedSubscription).toBeUndefined()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('skips in DAILY mode when a reminder was already sent today', async () => {
    const config = { ...makeConfig(), REMINDER_MODE: 'DAILY' as const }
    const sub = makeSubscription({
      lastReminderSentAt: '2026-05-29T05:00:00.000Z',
      lastCheckedExpiryDate: '2026-06-01T00:00:00.000Z',
    })
    const result = await processSubscriptionReminder(sub, currentTime, config)
    expect(result.action).toBe('skipped')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('reminds again in DAILY mode when the last reminder was a previous day', async () => {
    sendMock.mockResolvedValue(okResult)
    const config = { ...makeConfig(), REMINDER_MODE: 'DAILY' as const }
    const sub = makeSubscription({
      lastReminderSentAt: '2026-05-28T23:00:00.000Z',
      lastCheckedExpiryDate: '2026-06-01T00:00:00.000Z',
    })
    const result = await processSubscriptionReminder(sub, currentTime, config)
    expect(result.action).toBe('reminded')
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('returns reminded:false with the renewed copy when send fails after renewal', async () => {
    sendMock.mockResolvedValue(failResult)
    renewalMock.mockReturnValue({ renewed: true, newExpiryDate: '2026-05-31T00:00:00.000Z' })
    const sub = makeSubscription({
      autoRenew: true,
      expiryDate: '2026-05-01T00:00:00.000Z',
    })
    const result = await processSubscriptionReminder(sub, currentTime, makeConfig())
    expect(result.action).toBe('reminded')
    expect(result.success).toBe(false)
    expect(result.updatedSubscription?.expiryDate).toBe('2026-05-31T00:00:00.000Z')
  })

  it('returns skipped:false when processing throws', async () => {
    sendMock.mockRejectedValue(new Error('network down'))
    const sub = makeSubscription()
    const result = await processSubscriptionReminder(sub, currentTime, makeConfig())
    expect(result.action).toBe('skipped')
    expect(result.success).toBe(false)
    expect(result.updatedSubscription).toBeUndefined()
  })
})
