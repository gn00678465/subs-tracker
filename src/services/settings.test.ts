import { afterEach, beforeEach, expect, test } from 'bun:test'

import { readChannels, recordChannelResult } from '../db/settings'
import { insertSubscription } from '../db/subscriptions'
import { createTestDb, legacyKv } from '../test/d1'
import type { Bindings } from '../types'
import { verifyPassword } from '../utils/crypto'
import {
  exportData,
  loadSettings,
  readSettingsView,
  saveAccount,
  saveChannel,
  saveReminderSettings,
  testChannel,
} from './settings'

let env: Bindings
let dispose: () => Promise<void>
const realFetch = globalThis.fetch

beforeEach(async () => {
  const created = await createTestDb()
  env = { DB: created.db, SUBSCRIPTIONS_KV: legacyKv() }
  dispose = created.dispose
})
afterEach(async () => {
  globalThis.fetch = realFetch
  await dispose()
})

const telegram = async () => (await readChannels(env.DB)).find((c) => c.channel === 'telegram')

test('a new password is stored as a hash', async () => {
  await saveAccount(env, { username: 'madao', password: 'new-password' })
  const settings = await loadSettings(env)
  expect(settings.adminUsername).toBe('madao')
  expect(settings.adminPasswordHash).not.toBe('new-password')
  expect(await verifyPassword('new-password', settings.adminPasswordHash, settings.jwtSecret)).toBe(true)
})

test('reminder settings save only the given fields', async () => {
  await saveReminderSettings(env, { timezone: 'Asia/Taipei', reminderHour: 21 })
  expect((await readSettingsView(env)).reminder).toEqual({
    timezone: 'Asia/Taipei',
    reminderHour: 21,
    reminderMode: 'ONCE',
    defaultReminderDays: 3,
  })
})

test('a channel cannot be enabled without its required fields', async () => {
  await expect(saveChannel(env, 'telegram', true, { TELEGRAM_BOT_TOKEN: '123:abc' })).rejects.toThrow(
    '啟用前請填寫：TELEGRAM_CHAT_ID',
  )
  expect(await telegram()).toMatchObject({ enabled: false, config: {} })

  const saved = await saveChannel(env, 'telegram', false, { TELEGRAM_BOT_TOKEN: '123:abc' })
  expect(saved).toMatchObject({ enabled: false, missingFields: ['TELEGRAM_CHAT_ID'] })
})

test('empty fields and fields of other channels are dropped', async () => {
  await saveChannel(env, 'telegram', true, { TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_CHAT_ID: '42', BARK_KEY: 'x' })
  await saveChannel(env, 'telegram', false, { TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_CHAT_ID: '' })
  expect((await telegram())?.config).toEqual({ TELEGRAM_BOT_TOKEN: '123:abc' })
})

test('saving a channel keeps the delivery result written by Cron', async () => {
  await loadSettings(env)
  await recordChannelResult(env.DB, 'telegram', 'failed', 'Unauthorized', '2026-09-26T01:00:00.000Z').run()
  await saveChannel(env, 'telegram', true, { TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_CHAT_ID: '42' })
  expect(await telegram()).toMatchObject({ enabled: true, lastStatus: 'failed', lastError: 'Unauthorized' })
})

test('a test send uses the unsaved values and does not change the delivery result', async () => {
  const requests: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).startsWith('https://api.telegram.org/')) return realFetch(input, init)
    requests.push(String(input))
    return Response.json({ ok: true, result: { message_id: 1 } })
  }) as typeof fetch

  await saveChannel(env, 'telegram', false, { TELEGRAM_BOT_TOKEN: 'old', TELEGRAM_CHAT_ID: '42' })
  const result = await testChannel('telegram', { TELEGRAM_BOT_TOKEN: 'unsaved', TELEGRAM_CHAT_ID: '42' })

  expect(result.success).toBe(true)
  expect(requests).toEqual(['https://api.telegram.org/botunsaved/sendMessage'])
  expect(await telegram()).toMatchObject({ config: { TELEGRAM_BOT_TOKEN: 'old' }, lastStatus: null })
})

test('the export has subscriptions and settings but no secrets', async () => {
  await saveChannel(env, 'telegram', true, { TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_CHAT_ID: '42' })
  await insertSubscription(env.DB, {
    id: 'sub-1',
    name: 'Netflix',
    category: '影音',
    currency: 'TWD',
    price: 390,
    periodValue: 1,
    periodUnit: 'month',
    expiryDate: '2026-10-01',
    autoRenew: true,
    isFreeTrial: false,
    reminder: 'default',
    paymentMethod: '信用卡',
    website: '',
    notes: '',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastReminderSentAt: '2026-09-28T09:00:00.000Z',
  }).run()
  const settings = await loadSettings(env)

  const data = await exportData(env, new Date('2026-09-26T09:00:00.000Z'))
  const text = JSON.stringify(data)

  expect(data.channels).toContainEqual({ channel: 'telegram', enabled: true })
  expect(data.subscriptions).toHaveLength(1)
  expect(data.subscriptions[0]).not.toHaveProperty('lastReminderSentAt')
  for (const secret of ['123:abc', settings.jwtSecret, settings.adminPasswordHash]) {
    expect(text).not.toContain(secret)
  }
})
