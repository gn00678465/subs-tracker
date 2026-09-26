import { afterEach, beforeEach, expect, test } from 'bun:test'

import { sign } from 'hono/jwt'

import { createOpenAPIApp } from '../openapi'
import { loadSettings } from '../services/settings'
import { createTestDb, legacyKv } from '../test/d1'
import type { Bindings } from '../types'
import subscriptions from './subscriptions'

const app = createOpenAPIApp()
app.route('/api/subscriptions', subscriptions)

let env: Bindings
let dispose: () => Promise<void>

beforeEach(async () => {
  const created = await createTestDb()
  env = { DB: created.db, SUBSCRIPTIONS_KV: legacyKv() }
  dispose = created.dispose
})
afterEach(() => dispose())

async function create(website: string): Promise<number> {
  const now = Math.floor(Date.now() / 1000)
  const token = await sign(
    { username: 'admin', iat: now, exp: now + 3600 },
    (await loadSettings(env)).jwtSecret,
    'HS256',
  )
  const body = {
    name: 'Netflix',
    currency: 'TWD',
    price: 390,
    periodValue: 1,
    periodUnit: 'month',
    expiryDate: '2026-10-01',
    autoRenew: true,
    website,
  }
  const response = await app.request(
    'https://subs.example.com/api/subscriptions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': `token=${token}` },
      body: JSON.stringify(body),
    },
    env,
  )
  return response.status
}

test('the website must be empty or an http(s) URL, because cards render it as a link', async () => {
  expect(await create('javascript:alert(1)')).toBe(400)
  expect(await create('https://www.netflix.com')).toBe(201)
  expect(await create('')).toBe(201)
})
