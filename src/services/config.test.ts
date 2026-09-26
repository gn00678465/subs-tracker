import { describe, expect, test } from 'bun:test'

import type { Bindings } from '../types'
import { getConfig } from './config'

function envWith(stored: Record<string, unknown>): Bindings {
  const data = new Map([['config', JSON.stringify(stored)]])
  const kv = {
    get: async (key: string) => data.get(key) ?? null,
    put: async (key: string, value: string) => void data.set(key, value),
  }
  return { DB: {} as D1Database, SUBSCRIPTIONS_KV: kv as unknown as KVNamespace }
}

describe('REMINDER_HOUR', () => {
  test('stored value is kept', async () => {
    const config = await getConfig(envWith({ TIMEZONE: 'Asia/Taipei', REMINDER_HOUR: 21 }))
    expect(config.REMINDER_HOUR).toBe(21)
  })

  test('legacy config keeps sending at UTC 00:00, expressed in the user timezone', async () => {
    expect((await getConfig(envWith({ TIMEZONE: 'Asia/Taipei' }))).REMINDER_HOUR).toBe(8)
    expect((await getConfig(envWith({}))).REMINDER_HOUR).toBe(0)
  })

  test('out-of-range value falls back to the legacy hour', async () => {
    const config = await getConfig(envWith({ TIMEZONE: 'Asia/Tokyo', REMINDER_HOUR: 25 }))
    expect(config.REMINDER_HOUR).toBe(9)
  })
})
