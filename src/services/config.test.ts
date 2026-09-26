import { afterEach, beforeEach, expect, test } from 'bun:test'

import { recordChannelResult, readChannels } from '../db/settings'
import { createTestDb, legacyKv } from '../test/d1'
import type { Bindings } from '../types'
import { verifyPassword } from '../utils/crypto'
import { getConfig, updateConfig } from './config'

let env: Bindings
let dispose: () => Promise<void>

beforeEach(async () => {
  const test = await createTestDb()
  env = { DB: test.db, SUBSCRIPTIONS_KV: legacyKv() }
  dispose = test.dispose
})
afterEach(() => dispose())

test('password is stored as a hash', async () => {
  await updateConfig({ ADMIN_PASSWORD: 'new-password' }, env)
  const config = await getConfig(env)
  expect(config.ADMIN_PASSWORD).not.toBe('new-password')
  expect(await verifyPassword('new-password', config.ADMIN_PASSWORD, config.JWT_SECRET)).toBe(true)
})

test('settings and channels are saved together', async () => {
  await updateConfig(
    {
      TIMEZONE: 'Asia/Taipei',
      REMINDER_HOUR: 21,
      DEFAULT_REMINDER_DAYS: 7,
      ENABLED_NOTIFIERS: ['telegram'],
      TELEGRAM_BOT_TOKEN: '123:abc',
      TELEGRAM_CHAT_ID: '42',
    },
    env,
  )
  const config = await getConfig(env)
  expect(config).toMatchObject({
    TIMEZONE: 'Asia/Taipei',
    REMINDER_HOUR: 21,
    DEFAULT_REMINDER_DAYS: 7,
    ENABLED_NOTIFIERS: ['telegram'],
    TELEGRAM_BOT_TOKEN: '123:abc',
    TELEGRAM_CHAT_ID: '42',
  })
})

test('an empty channel field clears it and keeps the other fields', async () => {
  await updateConfig({ TELEGRAM_BOT_TOKEN: '123:abc', TELEGRAM_CHAT_ID: '42' }, env)
  await updateConfig({ TELEGRAM_CHAT_ID: '' }, env)
  const telegram = (await readChannels(env.DB)).find((c) => c.channel === 'telegram')
  expect(telegram?.config).toEqual({ TELEGRAM_BOT_TOKEN: '123:abc' })
})

test('saving a channel keeps the last delivery result written by Cron', async () => {
  await getConfig(env)
  await recordChannelResult(env.DB, 'bark', 'failed', 'HTTP 500', '2026-09-26T01:00:00.000Z').run()
  await updateConfig({ BARK_KEY: 'new-key' }, env)
  const bark = (await readChannels(env.DB)).find((c) => c.channel === 'bark')
  expect(bark).toMatchObject({ config: { BARK_KEY: 'new-key' }, lastStatus: 'failed', lastError: 'HTTP 500' })
})

test('an invalid value is rejected by the schema and nothing changes', async () => {
  await expect(updateConfig({ REMINDER_HOUR: 24, TELEGRAM_CHAT_ID: '42' }, env)).rejects.toThrow()
  const config = await getConfig(env)
  expect(config.REMINDER_HOUR).toBe(9)
  expect(config.TELEGRAM_CHAT_ID).toBeUndefined()
})
