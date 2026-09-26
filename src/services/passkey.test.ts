import { afterEach, beforeEach, expect, test } from 'bun:test'

import { findPasskey, insertPasskey } from '../db/passkeys'
import { SoftAuthenticator } from '../test/authenticator'
import { createTestDb, legacyKv } from '../test/d1'
import type { Bindings } from '../types'
import {
  authenticationOptions,
  deletePasskeyById,
  listPasskeyViews,
  registrationOptions,
  relyingParty,
  renamePasskeyById,
  verifyAuthentication,
  verifyRegistration,
} from './passkey'

const ORIGIN = 'https://subs.example.com'
const rp = relyingParty(`${ORIGIN}/api/webauthn/register/options`)
const APPLE = 'fbfc3007-154e-4ecc-8c0b-6e020557d7bd'

let env: Bindings
let dispose: () => Promise<void>

beforeEach(async () => {
  const created = await createTestDb()
  env = { DB: created.db, SUBSCRIPTIONS_KV: legacyKv() }
  dispose = created.dispose
})
afterEach(() => dispose())

async function registered(aaguid = APPLE): Promise<SoftAuthenticator> {
  const authenticator = await SoftAuthenticator.create(aaguid)
  const options = await registrationOptions(env, rp)
  await verifyRegistration(env, rp, await authenticator.register(options, ORIGIN), 'test-agent')
  return authenticator
}

test('the RP ID is the registrable domain and the origin is the request URL', () => {
  expect(rp).toEqual({ rpID: 'example.com', origin: 'https://subs.example.com' })
  expect(relyingParty('http://localhost:5173/x')).toEqual({ rpID: 'localhost', origin: 'http://localhost:5173' })
})

test('register, then sign in with the same passkey', async () => {
  const authenticator = await registered()

  expect(await listPasskeyViews(env, rp)).toEqual([
    {
      id: authenticator.id,
      nickname: null,
      provider: 'iCloud 鑰匙圈',
      createdAt: expect.any(String),
      lastUsedAt: null,
      synced: true,
      usableHere: true,
    },
  ])

  const options = await authenticationOptions(env, rp, { conditional: false })
  expect(options.allowCredentials?.map((c) => c.id)).toEqual([authenticator.id])
  expect(await verifyAuthentication(env, rp, await authenticator.authenticate(options, ORIGIN))).toBe('admin')
  expect((await findPasskey(env.DB, authenticator.id))?.lastUsedAt).not.toBeNull()
})

test('the user handle stays the same for every passkey', async () => {
  const first = await registrationOptions(env, rp)
  const second = await registrationOptions(env, rp)
  expect(second.user.id).toBe(first.user.id)
  expect(second.authenticatorSelection).toMatchObject({ residentKey: 'required', userVerification: 'required' })
})

test('a challenge works only once', async () => {
  const authenticator = await registered()
  const response = await authenticator.authenticate(
    await authenticationOptions(env, rp, { conditional: false }),
    ORIGIN,
  )
  await verifyAuthentication(env, rp, response)
  await expect(verifyAuthentication(env, rp, response)).rejects.toThrow('驗證已逾時')
})

test('an assertion made on another subdomain is rejected', async () => {
  const authenticator = await registered()
  const options = await authenticationOptions(env, rp, { conditional: false })
  const response = await authenticator.authenticate(options, 'https://evil.example.com')
  await expect(verifyAuthentication(env, rp, response)).rejects.toThrow('passkey 驗證失敗')
})

test('a legacy passkey without an RP ID gets one on its first sign-in', async () => {
  const authenticator = await registered()
  await env.DB.prepare('UPDATE passkey_credentials SET rp_id = NULL').run()

  expect((await listPasskeyViews(env, rp))[0].usableHere).toBe(true)
  const options = await authenticationOptions(env, rp, { conditional: false })
  await verifyAuthentication(env, rp, await authenticator.authenticate(options, ORIGIN))
  expect((await findPasskey(env.DB, authenticator.id))?.rpId).toBe('example.com')
})

test('a passkey for another domain is listed but cannot sign in here', async () => {
  const authenticator = await registered()
  const passkey = await findPasskey(env.DB, authenticator.id)
  await env.DB.prepare('DELETE FROM passkey_credentials').run()
  await insertPasskey(env.DB, { ...passkey!, rpId: 'other.dev' })

  expect((await listPasskeyViews(env, rp))[0].usableHere).toBe(false)
  await expect(authenticationOptions(env, rp, { conditional: false })).rejects.toThrow('沒有可以使用的 passkey')
  const conditional = await authenticationOptions(env, rp, { conditional: true })
  expect(conditional.allowCredentials).toEqual([])
  await expect(verifyAuthentication(env, rp, await authenticator.authenticate(conditional, ORIGIN))).rejects.toThrow(
    '在此網址無法使用',
  )
})

test('rename and delete', async () => {
  const authenticator = await registered('00000000-0000-0000-0000-000000000000')
  expect((await listPasskeyViews(env, rp))[0].provider).toBeNull()

  expect(await renamePasskeyById(env, authenticator.id, '  工作電腦  ')).toBe(true)
  expect((await listPasskeyViews(env, rp))[0].nickname).toBe('工作電腦')
  expect(await renamePasskeyById(env, authenticator.id, '')).toBe(true)
  expect((await listPasskeyViews(env, rp))[0].nickname).toBeNull()

  expect(await deletePasskeyById(env, authenticator.id)).toBe(true)
  expect(await deletePasskeyById(env, authenticator.id)).toBe(false)
  const options = await authenticationOptions(env, rp, { conditional: true })
  await expect(verifyAuthentication(env, rp, await authenticator.authenticate(options, ORIGIN))).rejects.toThrow(
    '已經刪除',
  )
})
