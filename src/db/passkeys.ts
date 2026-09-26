import type { CredentialDeviceType } from '@simplewebauthn/server'

export interface Passkey {
  id: string
  /** base64url */
  publicKey: string
  counter: number
  transports: string[]
  /** null：從 KV 匯入、還沒登入過的舊憑證 */
  rpId: string | null
  aaguid: string | null
  nickname: string | null
  deviceType: CredentialDeviceType | null
  backedUp: boolean | null
  userAgent: string | null
  createdAt: string
  lastUsedAt: string | null
}

interface PasskeyRow {
  id: string
  public_key: string
  counter: number
  transports: string
  rp_id: string | null
  aaguid: string | null
  nickname: string | null
  device_type: CredentialDeviceType | null
  backed_up: number | null
  user_agent: string | null
  created_at: string
  last_used_at: string | null
}

function toPasskey(row: PasskeyRow): Passkey {
  return {
    id: row.id,
    publicKey: row.public_key,
    counter: row.counter,
    transports: JSON.parse(row.transports) as string[],
    rpId: row.rp_id,
    aaguid: row.aaguid,
    nickname: row.nickname,
    deviceType: row.device_type,
    backedUp: row.backed_up === null ? null : row.backed_up === 1,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }
}

export async function listPasskeys(db: D1Database): Promise<Passkey[]> {
  const { results } = await db.prepare('SELECT * FROM passkey_credentials ORDER BY created_at').all<PasskeyRow>()
  return results.map(toPasskey)
}

export async function findPasskey(db: D1Database, id: string): Promise<Passkey | null> {
  const row = await db.prepare('SELECT * FROM passkey_credentials WHERE id = ?').bind(id).first<PasskeyRow>()
  return row ? toPasskey(row) : null
}

export async function insertPasskey(db: D1Database, passkey: Passkey): Promise<void> {
  await db
    .prepare(
      `INSERT INTO passkey_credentials
         (id, public_key, counter, transports, rp_id, aaguid, nickname, device_type, backed_up, user_agent, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      passkey.id,
      passkey.publicKey,
      passkey.counter,
      JSON.stringify(passkey.transports),
      passkey.rpId,
      passkey.aaguid,
      passkey.nickname,
      passkey.deviceType,
      passkey.backedUp === null ? null : passkey.backedUp ? 1 : 0,
      passkey.userAgent,
      passkey.createdAt,
      passkey.lastUsedAt,
    )
    .run()
}

/** 登入成功後更新；舊憑證的 rp_id 在這時補上 */
export async function recordPasskeyUse(
  db: D1Database,
  id: string,
  use: { counter: number; backedUp: boolean; deviceType: CredentialDeviceType; rpId: string; at: string },
): Promise<void> {
  await db
    .prepare(
      `UPDATE passkey_credentials
       SET counter = ?, backed_up = ?, device_type = ?, rp_id = COALESCE(rp_id, ?), last_used_at = ?
       WHERE id = ?`,
    )
    .bind(use.counter, use.backedUp ? 1 : 0, use.deviceType, use.rpId, use.at, id)
    .run()
}

export async function renamePasskey(db: D1Database, id: string, nickname: string | null): Promise<boolean> {
  const result = await db.prepare('UPDATE passkey_credentials SET nickname = ? WHERE id = ?').bind(nickname, id).run()
  return result.meta.changes > 0
}

export async function deletePasskey(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM passkey_credentials WHERE id = ?').bind(id).run()
  return result.meta.changes > 0
}

export type ChallengeType = 'registration' | 'authentication'

/** 同時清掉已過期的 challenge，資料表不會一直變大 */
export async function storeChallenge(
  db: D1Database,
  challenge: string,
  type: ChallengeType,
  now: number,
  ttlMs: number,
): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM webauthn_challenges WHERE expires_at < ?').bind(now),
    db
      .prepare('INSERT INTO webauthn_challenges (challenge, type, expires_at) VALUES (?, ?, ?)')
      .bind(challenge, type, now + ttlMs),
  ])
}

/** 一次性取用：DELETE … RETURNING 讓同一個 challenge 只能成功一次 */
export async function takeChallenge(
  db: D1Database,
  challenge: string,
  type: ChallengeType,
  now: number,
): Promise<boolean> {
  const row = await db
    .prepare('DELETE FROM webauthn_challenges WHERE challenge = ? AND type = ? RETURNING expires_at')
    .bind(challenge, type)
    .first<{ expires_at: number }>()
  return row !== null && row.expires_at >= now
}

/** 固定的 user handle；並行的第一次註冊只有一個值會寫入 */
export async function ensureUserHandle(db: D1Database, candidate: string): Promise<string> {
  await db
    .prepare('UPDATE settings SET webauthn_user_handle = ? WHERE id = 1 AND webauthn_user_handle IS NULL')
    .bind(candidate)
    .run()
  const row = await db
    .prepare('SELECT webauthn_user_handle FROM settings WHERE id = 1')
    .first<{ webauthn_user_handle: string | null }>()
  if (!row?.webauthn_user_handle) throw new Error('讀不到 webauthn_user_handle')
  return row.webauthn_user_handle
}
