import { afterEach, beforeEach, expect, test } from 'bun:test'

import { sign } from 'hono/jwt'

import { createOpenAPIApp } from '../openapi'
import { loadSettings } from '../services/settings'
import { createTestDb, legacyKv } from '../test/d1'
import type { Bindings } from '../types'
import settings from './settings'
import webauthn from './webauthn'

const app = createOpenAPIApp()
app.route('/api/settings', settings)
app.route('/api/webauthn', webauthn)

let env: Bindings
let dispose: () => Promise<void>

beforeEach(async () => {
  const created = await createTestDb()
  env = { DB: created.db, SUBSCRIPTIONS_KV: legacyKv() }
  dispose = created.dispose
})
afterEach(() => dispose())

async function tokenSignedMinutesAgo(minutes: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const { jwtSecret } = await loadSettings(env)
  return sign({ username: 'admin', iat: now - minutes * 60, exp: now + 3600 }, jwtSecret, 'HS256')
}

async function call(method: string, path: string, token: string | null, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Cookie = `token=${token}`
  const response = await app.request(
    `https://subs.example.com${path}`,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    env,
  )
  const json = (await response.json()) as { code?: string }
  return { status: response.status, code: json.code }
}

test('adding or deleting a passkey and changing the account need a sign-in within 10 minutes', async () => {
  const stale = await tokenSignedMinutesAgo(11)
  const fresh = await tokenSignedMinutesAgo(9)

  for (const [method, path, body] of [
    ['POST', '/api/webauthn/register/options', undefined],
    ['DELETE', '/api/webauthn/credentials/unknown', undefined],
    ['PUT', '/api/settings/account', { username: 'madao' }],
  ] as const) {
    expect(await call(method, path, stale, body)).toEqual({ status: 403, code: 'REAUTH_REQUIRED' })
    expect((await call(method, path, fresh, body)).status).not.toBe(403)
  }
})

test('listing and renaming passkeys do not need a recent sign-in', async () => {
  const stale = await tokenSignedMinutesAgo(60)
  expect((await call('GET', '/api/webauthn/credentials', stale)).status).toBe(200)
  expect((await call('PUT', '/api/webauthn/credentials/unknown', stale, { nickname: 'x' })).status).toBe(404)
})

test('passkey routes other than sign-in need a session', async () => {
  expect((await call('GET', '/api/webauthn/credentials', null)).status).toBe(401)
  expect((await call('POST', '/api/webauthn/register/options', null)).status).toBe(401)
  expect(await call('POST', '/api/webauthn/authenticate/options', null, { conditional: true })).toMatchObject({
    status: 200,
  })
})
