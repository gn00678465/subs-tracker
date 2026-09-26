import { Buffer } from 'node:buffer'

import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import psl from 'psl'

import type { ChallengeType, Passkey } from '../db/passkeys'
import {
  deletePasskey,
  ensureUserHandle,
  findPasskey,
  insertPasskey,
  listPasskeys,
  recordPasskeyUse,
  renamePasskey,
  storeChallenge,
  takeChallenge,
} from '../db/passkeys'
import type { Bindings } from '../types'
import { UserError } from '../utils/errors'
import { loadSettings } from './settings'

const RP_NAME = 'SubsTracker'
// options 的 timeout 與 challenge 的有效時間相同
const CEREMONY_MS = 5 * 60 * 1000

// 只列出已查證的 AAGUID（docs/research/2026-09-26-passkey-settings-ux.md §5.4）；對照表的授權未確認，不整份打包
const PROVIDER_NAMES: Record<string, string> = {
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'iCloud 鑰匙圈',
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google 密碼管理工具',
  'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
  'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden', // gitleaks:allow 公開的 AAGUID，不是金鑰
}

export interface RelyingParty {
  rpID: string
  origin: string
}

/**
 * RP ID 沿用舊版的可註冊網域，舊的 passkey 升級後仍可使用。
 * origin 取自請求網址，不取自請求標頭：其他子網域取得的 assertion 帶著自己的 origin，驗證時會被拒絕。
 */
export function relyingParty(requestUrl: string): RelyingParty {
  const url = new URL(requestUrl)
  return { rpID: psl.get(url.hostname) ?? url.hostname, origin: url.origin }
}

export interface PasskeyView {
  id: string
  nickname: string | null
  provider: string | null
  createdAt: string
  lastUsedAt: string | null
  /** true：已同步；false：僅限此裝置；null：舊憑證，登入後才知道 */
  synced: boolean | null
  /** RP ID 與目前網址不同的 passkey 在這個網址不能使用 */
  usableHere: boolean
}

function isUsable(passkey: Passkey, rp: RelyingParty): boolean {
  return (passkey.rpId ?? rp.rpID) === rp.rpID
}

function toView(passkey: Passkey, rp: RelyingParty): PasskeyView {
  return {
    id: passkey.id,
    nickname: passkey.nickname,
    provider: passkey.aaguid ? (PROVIDER_NAMES[passkey.aaguid] ?? null) : null,
    createdAt: passkey.createdAt,
    lastUsedAt: passkey.lastUsedAt,
    synced: passkey.backedUp,
    usableHere: isUsable(passkey, rp),
  }
}

export async function listPasskeyViews(env: Bindings, rp: RelyingParty): Promise<PasskeyView[]> {
  return (await listPasskeys(env.DB)).map((passkey) => toView(passkey, rp))
}

function challengeOf(response: { response: { clientDataJSON: string } }): string {
  try {
    const clientData = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8'))
    if (typeof clientData.challenge === 'string') return clientData.challenge
  } catch {
    // 落到下面的錯誤
  }
  throw new UserError('驗證資料格式錯誤，請重試')
}

async function consumeChallenge(env: Bindings, challenge: string, type: ChallengeType): Promise<void> {
  if (!(await takeChallenge(env.DB, challenge, type, Date.now()))) {
    throw new UserError('驗證已逾時，請重試')
  }
}

export async function registrationOptions(
  env: Bindings,
  rp: RelyingParty,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const settings = await loadSettings(env)
  const userHandle = await ensureUserHandle(
    env.DB,
    Buffer.from(crypto.getRandomValues(new Uint8Array(64))).toString('base64url'),
  )
  const existing = await listPasskeys(env.DB)

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp.rpID,
    userID: Buffer.from(userHandle, 'base64url'),
    userName: settings.adminUsername,
    // 登入頁的自動填入需要可探索的憑證
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    excludeCredentials: existing.map((passkey) => ({ id: passkey.id, transports: passkey.transports })),
    timeout: CEREMONY_MS,
  })
  await storeChallenge(env.DB, options.challenge, 'registration', Date.now(), CEREMONY_MS)
  return options
}

export async function verifyRegistration(
  env: Bindings,
  rp: RelyingParty,
  response: RegistrationResponseJSON,
  userAgent: string | null,
): Promise<PasskeyView> {
  const challenge = challengeOf(response)
  await consumeChallenge(env, challenge, 'registration')

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
  }).catch((error: unknown) => {
    throw new UserError(`無法驗證這個 passkey：${error instanceof Error ? error.message : String(error)}`)
  })
  if (!verification.verified) throw new UserError('無法驗證這個 passkey')

  const { credential, aaguid, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
  const passkey: Passkey = {
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: response.response.transports ?? [],
    rpId: rp.rpID,
    aaguid,
    nickname: null,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    userAgent,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  }
  await insertPasskey(env.DB, passkey)
  return toView(passkey, rp)
}

/**
 * conditional：登入頁的自動填入，不列出憑證，讓瀏覽器提供可探索的 passkey。
 * 按鈕登入時列出這個網址可用的憑證，不可探索的舊安全金鑰也能使用。
 */
export async function authenticationOptions(
  env: Bindings,
  rp: RelyingParty,
  { conditional }: { conditional: boolean },
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const usable = (await listPasskeys(env.DB)).filter((passkey) => isUsable(passkey, rp))
  if (!conditional && usable.length === 0) throw new UserError('這個網址沒有可以使用的 passkey')

  const options = await generateAuthenticationOptions({
    rpID: rp.rpID,
    allowCredentials: conditional ? [] : usable.map((passkey) => ({ id: passkey.id, transports: passkey.transports })),
    userVerification: 'required',
    timeout: CEREMONY_MS,
  })
  await storeChallenge(env.DB, options.challenge, 'authentication', Date.now(), CEREMONY_MS)
  return options
}

/** 成功時回傳使用者名稱，由路由簽發登入狀態 */
export async function verifyAuthentication(
  env: Bindings,
  rp: RelyingParty,
  response: AuthenticationResponseJSON,
): Promise<string> {
  const challenge = challengeOf(response)
  await consumeChallenge(env, challenge, 'authentication')

  const passkey = await findPasskey(env.DB, response.id)
  if (!passkey) throw new UserError('這個 passkey 已經刪除，請改用密碼登入')
  if (!isUsable(passkey, rp)) throw new UserError('這個 passkey 在此網址無法使用')

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    credential: {
      id: passkey.id,
      publicKey: Buffer.from(passkey.publicKey, 'base64url'),
      counter: passkey.counter,
      transports: passkey.transports,
    },
  }).catch((error: unknown) => {
    throw new UserError(`passkey 驗證失敗：${error instanceof Error ? error.message : String(error)}`)
  })
  if (!verification.verified) throw new UserError('passkey 驗證失敗')

  const { newCounter, credentialBackedUp, credentialDeviceType } = verification.authenticationInfo
  await recordPasskeyUse(env.DB, passkey.id, {
    counter: newCounter,
    backedUp: credentialBackedUp,
    deviceType: credentialDeviceType,
    rpId: rp.rpID,
    at: new Date().toISOString(),
  })
  return (await loadSettings(env)).adminUsername
}

/** 空白名稱代表恢復預設的提供者名稱 */
export async function renamePasskeyById(env: Bindings, id: string, nickname: string): Promise<boolean> {
  return renamePasskey(env.DB, id, nickname.trim() || null)
}

export async function deletePasskeyById(env: Bindings, id: string): Promise<boolean> {
  return deletePasskey(env.DB, id)
}
