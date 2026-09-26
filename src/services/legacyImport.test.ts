import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { readSettings } from '../db/settings'
import { listSubscriptions } from '../db/subscriptions'
import { createTestDb, legacyKv } from '../test/d1'
import type { Bindings } from '../types'
import { hashPassword, verifyPassword } from '../utils/crypto'
import { loadSettings, readSettingsView } from './settings'

let db: D1Database
let dispose: () => Promise<void>

beforeEach(async () => {
  ;({ db, dispose } = await createTestDb())
})
afterEach(() => dispose())

const env = (kv: Record<string, unknown> = {}): Bindings => ({ DB: db, SUBSCRIPTIONS_KV: legacyKv(kv) })

const legacySubscription = {
  id: '1703123456789',
  name: 'Netflix',
  customType: '串流媒體',
  category: '',
  currency: 'TWD',
  price: '390',
  periodValue: 1,
  periodUnit: 'month',
  periodMethod: 'credit',
  expiryDate: '2026-10-02T00:00:00.000Z',
  startDate: '2024-01-05T00:00:00.000Z',
  lastCheckedExpiryDate: '2026-10-02T00:00:00.000Z',
  hasEndDate: true,
  autoRenew: true,
  isReminderSet: true,
  reminderMe: 7,
  isActive: true,
  createdAt: '2024-01-05T08:00:00.000Z',
  updatedAt: '2024-01-05T08:00:00.000Z',
}

const legacyConfig = {
  ADMIN_USERNAME: 'madao',
  ADMIN_PASSWORD: 'hunter22',
  JWT_SECRET: 'legacy-secret',
  TIMEZONE: 'Asia/Taipei',
  TG_BOT_TOKEN: '123:abc',
  TG_CHAT_ID: '42',
  BARK_DEVICE_KEY: 'bark-key',
  ENABLED_NOTIFIERS: ['telegram', 'notifyx'],
  WEBAUTHN_RP_ID: 'example.com',
}

describe('first read imports the legacy KV once', () => {
  test('empty KV creates default settings with a hashed password', async () => {
    const settings = await loadSettings(env())
    expect(settings.adminUsername).toBe('admin')
    expect(settings.timezone).toBe('UTC')
    expect(settings.reminderHour).toBe(9)
    expect(await verifyPassword('password', settings.adminPasswordHash, settings.jwtSecret)).toBe(true)
    expect(await listSubscriptions(db)).toEqual([])
  })

  test('legacy config, subscriptions and passkeys are converted', async () => {
    const kv = env({
      'config': legacyConfig,
      'subscriptions': [legacySubscription],
      'webauthn:user:madao:credentials': { credentialIDs: ['cred-1'] },
      'webauthn:credential:cred-1': {
        credentialID: 'cred-1',
        publicKey: 'pk',
        counter: 3,
        transports: ['internal'],
        createdAt: '2025-01-01T00:00:00.000Z',
        backedUp: true,
      },
    })
    const settings = await loadSettings(kv)
    const view = await readSettingsView(kv)

    expect(settings.adminUsername).toBe('madao')
    expect(settings.jwtSecret).toBe('legacy-secret')
    expect(await verifyPassword('hunter22', settings.adminPasswordHash, 'legacy-secret')).toBe(true)
    // 舊版在 UTC 00:00 發送，台北是 08:00
    expect(view.reminder).toEqual({
      timezone: 'Asia/Taipei',
      reminderHour: 8,
      reminderMode: 'ONCE',
      defaultReminderDays: 3,
    })
    expect(view.channels.filter((c) => c.enabled || Object.keys(c.config).length > 0)).toMatchObject([
      { channel: 'telegram', enabled: true, config: { TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_CHAT_ID: '42' } },
      { channel: 'bark', enabled: false, config: { BARK_KEY: 'bark-key' } },
    ])

    expect(await listSubscriptions(db)).toEqual([
      {
        id: '1703123456789',
        name: 'Netflix',
        category: '串流媒體',
        currency: 'TWD',
        price: 390,
        periodValue: 1,
        periodUnit: 'month',
        expiryDate: '2026-10-01',
        startDate: '2024-01-05',
        cancelByDate: undefined,
        autoRenew: true,
        isFreeTrial: false,
        isActive: true,
        reminder: 7,
        paymentMethod: '信用卡',
        website: '',
        notes: '',
        lastReminderSentAt: undefined,
        lastCheckedExpiryDate: '2026-10-01',
        createdAt: '2024-01-05T08:00:00.000Z',
        updatedAt: '2024-01-05T08:00:00.000Z',
      },
    ])

    const passkey = await db.prepare('SELECT id, counter, transports, rp_id, backed_up FROM passkey_credentials').all()
    expect(passkey.results).toEqual([
      { id: 'cred-1', counter: 3, transports: '["internal"]', rp_id: 'example.com', backed_up: 1 },
    ])
  })

  test('a stored password hash is kept as is', async () => {
    const hash = await hashPassword('hunter22', 'legacy-secret')
    const settings = await loadSettings(env({ config: { ...legacyConfig, ADMIN_PASSWORD: hash } }))
    expect(settings.adminPasswordHash).toBe(hash)
  })

  test('a disabled reminder stays off', async () => {
    await loadSettings(env({ subscriptions: [{ ...legacySubscription, isReminderSet: false }] }))
    expect((await listSubscriptions(db))[0].reminder).toBe('off')
  })

  test('concurrent first reads get the same settings and import once', async () => {
    const kv = { config: { ...legacyConfig, JWT_SECRET: undefined }, subscriptions: [legacySubscription] }
    const [a, b] = await Promise.all([loadSettings(env(kv)), loadSettings(env(kv))])
    expect(a.jwtSecret).toBe(b.jwtSecret)
    expect(await listSubscriptions(db)).toHaveLength(1)
  })

  test('D1 changes after the import are not overwritten by the KV', async () => {
    const kv = { config: legacyConfig, subscriptions: [legacySubscription] }
    await loadSettings(env(kv))
    await db.prepare("UPDATE subscriptions SET name = 'Netflix 家庭'").run()
    await db.prepare('DELETE FROM settings').run()

    await loadSettings(env(kv))
    expect((await listSubscriptions(db))[0].name).toBe('Netflix 家庭')
  })

  test('an unconvertible record fails the import and writes nothing', async () => {
    const kv = { config: legacyConfig, subscriptions: [{ ...legacySubscription, expiryDate: 'not a date' }] }
    await expect(loadSettings(env(kv))).rejects.toThrow('到期日無法轉換')
    expect(await readSettings(db)).toBeNull()
    expect((await db.prepare('SELECT count(*) AS n FROM notification_channels').first())?.n).toBe(0)
  })
})
