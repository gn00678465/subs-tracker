import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { readChannels } from '../db/settings'
import { findSubscription, insertSubscription } from '../db/subscriptions'
import { createTestDb, legacyKv } from '../test/d1'
import type { Bindings, Subscription } from '../types'
import { saveChannel } from './settings'
import { rollForward } from './subscription'
import type { ReminderPolicy } from './subscription_cron'
import { planReminder, reminderMessage, runReminders } from './subscription_cron'

const base: Subscription = {
  id: 'sub-1',
  name: 'Netflix',
  category: '影音',
  currency: 'TWD',
  price: 390,
  periodValue: 1,
  periodUnit: 'month',
  expiryDate: '2026-09-28',
  autoRenew: true,
  isFreeTrial: false,
  reminder: 'default',
  paymentMethod: '信用卡',
  website: '',
  notes: '',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const policy: ReminderPolicy = { timezone: 'UTC', reminderMode: 'ONCE', defaultReminderDays: 3 }
const today = '2026-09-26'

describe('rollForward', () => {
  test('auto renewal moves a past date to the first date on or after today', () => {
    expect(rollForward({ ...base, expiryDate: '2026-08-31' }, today).expiryDate).toBe('2026-09-30')
    expect(rollForward({ ...base, expiryDate: '2026-09-26' }, today).expiryDate).toBe('2026-09-26')
  })

  test('a manual renewal stays expired', () => {
    const expired = { ...base, expiryDate: '2026-08-31', autoRenew: false }
    expect(rollForward(expired, today)).toBe(expired)
  })

  test('a finished trial becomes paid and loses its cancel-by date', () => {
    const trial = { ...base, expiryDate: '2026-09-20', isFreeTrial: true, cancelByDate: '2026-09-19' }
    expect(rollForward(trial, today)).toMatchObject({
      expiryDate: '2026-10-20',
      isFreeTrial: false,
      cancelByDate: undefined,
    })
  })
})

describe('planReminder', () => {
  test('default uses the configured days', () => {
    expect(planReminder(base, today, policy)).toEqual({ kind: 'renewal', date: '2026-09-28', daysLeft: 2 })
    expect(planReminder({ ...base, expiryDate: '2026-09-30' }, today, policy)).toBeNull()
    expect(planReminder({ ...base, expiryDate: '2026-09-30', reminder: 7 }, today, policy)).not.toBeNull()
  })

  test('off, paused and expired subscriptions are not reminded', () => {
    expect(planReminder({ ...base, reminder: 'off' }, today, policy)).toBeNull()
    expect(planReminder({ ...base, isActive: false }, today, policy)).toBeNull()
    expect(planReminder({ ...base, expiryDate: '2026-09-25', autoRenew: false }, today, policy)).toBeNull()
  })

  test('trial and cancel-by date change what is reminded', () => {
    expect(planReminder({ ...base, isFreeTrial: true }, today, policy)?.kind).toBe('trial')
    expect(planReminder({ ...base, expiryDate: '2026-10-20', cancelByDate: today }, today, policy)).toEqual({
      kind: 'cancelBy',
      date: today,
      daysLeft: 0,
    })
  })

  test('ONCE reminds again only after the date changes; DAILY once a day', () => {
    const sent = { ...base, lastReminderSentAt: '2026-09-25T09:00:00.000Z', lastCheckedExpiryDate: '2026-09-28' }
    expect(planReminder(sent, today, policy)).toBeNull()
    expect(planReminder({ ...sent, lastCheckedExpiryDate: '2026-09-27' }, today, policy)).not.toBeNull()
    expect(planReminder(sent, today, { ...policy, reminderMode: 'DAILY' })).not.toBeNull()
    expect(planReminder(sent, '2026-09-25', { ...policy, reminderMode: 'DAILY' })).toBeNull()
  })

  test('messages name the subscription, the date and the price', () => {
    expect(reminderMessage(base, { kind: 'trial', date: '2026-09-28', daysLeft: 2 })).toEqual({
      title: '試用即將結束：Netflix',
      content: '「Netflix」的試用2 天後結束（2026-09-28）。之後每期扣款 TWD 390。不想付費，請在結束前取消。',
    })
    expect(reminderMessage(base, { kind: 'cancelBy', date: today, daysLeft: 0 })).toEqual({
      title: '取消期限：Netflix',
      content: '「Netflix」的取消期限是今天（2026-09-26）。在期限內取消，才不會扣款 TWD 390。',
    })
  })
})

describe('runReminders', () => {
  const reminderTime = new Date('2026-09-26T09:00:00.000Z')
  const realFetch = globalThis.fetch
  let env: Bindings
  let dispose: () => Promise<void>
  let sent: string[]
  let telegramStatus: number
  let duringSend: () => Promise<void>

  beforeEach(async () => {
    const created = await createTestDb()
    env = { DB: created.db, SUBSCRIPTIONS_KV: legacyKv() }
    dispose = created.dispose
    sent = []
    telegramStatus = 200
    duringSend = async () => {}
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).startsWith('https://api.telegram.org/')) return realFetch(input, init)
      sent.push(JSON.parse(String(init?.body)).text)
      await duringSend()
      return Response.json({ ok: telegramStatus === 200, description: 'Bad Gateway' }, { status: telegramStatus })
    }) as typeof fetch
    await saveChannel(env, 'telegram', true, { TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '1' })
    await insertSubscription(env.DB, base).run()
  })
  afterEach(async () => {
    globalThis.fetch = realFetch
    await dispose()
  })

  const cronRuns = () => env.DB.prepare('SELECT reminded, failed, finished_at IS NOT NULL AS done FROM cron_runs').all()

  test('does nothing outside the reminder hour', async () => {
    await runReminders(env, new Date('2026-09-26T10:00:00.000Z'))
    expect(sent).toEqual([])
    expect((await cronRuns()).results).toEqual([])
  })

  test('sends once, then records the delivery, the channel status and the run', async () => {
    await runReminders(env, reminderTime)
    await runReminders(env, reminderTime)

    expect(sent).toEqual(['*續訂提醒：Netflix*\n\n「Netflix」2 天後扣款 TWD 390（2026-09-28）。'])
    expect((await findSubscription(env.DB, 'sub-1'))?.lastReminderSentAt).toBe(reminderTime.toISOString())
    expect((await readChannels(env.DB)).find((c) => c.channel === 'telegram')?.lastStatus).toBe('ok')
    expect((await cronRuns()).results).toEqual([
      { reminded: 1, failed: 0, done: 1 },
      { reminded: 0, failed: 0, done: 1 },
    ])
  })

  test('a failed send is recorded and retried next time', async () => {
    telegramStatus = 502
    await runReminders(env, reminderTime)

    expect((await findSubscription(env.DB, 'sub-1'))?.lastReminderSentAt).toBeUndefined()
    expect((await readChannels(env.DB)).find((c) => c.channel === 'telegram')).toMatchObject({
      lastStatus: 'failed',
      lastError: 'Bad Gateway',
    })
    const delivery = await env.DB.prepare('SELECT status, error FROM reminder_deliveries').first()
    expect(delivery).toEqual({ status: 'failed', error: 'Bad Gateway' })
    expect((await cronRuns()).results).toEqual([{ reminded: 0, failed: 1, done: 1 }])
  })

  test('an edit made while sending is not overwritten', async () => {
    // 2026-08-28 推進到 2026-09-28，在提醒範圍內
    await env.DB.prepare("UPDATE subscriptions SET expiry_date = '2026-08-28'").run()
    duringSend = async () => {
      await env.DB.prepare(
        "UPDATE subscriptions SET expiry_date = '2026-12-01', updated_at = '2026-09-26T09:00:01.000Z'",
      ).run()
    }
    await runReminders(env, reminderTime)

    expect(sent).toHaveLength(1)
    const after = await findSubscription(env.DB, 'sub-1')
    expect(after?.expiryDate).toBe('2026-12-01')
    expect(after?.lastReminderSentAt).toBeUndefined()
  })
})
