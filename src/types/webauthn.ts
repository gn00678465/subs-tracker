import type {
  AuthenticatorTransportFuture,
  Base64URLString,
  CredentialDeviceType,
} from '@simplewebauthn/server'

/**
 * KV 中儲存的憑證資料結構
 */
export interface StoredCredential {
  credentialID: Base64URLString
  publicKey: Base64URLString
  counter: number
  transports?: AuthenticatorTransportFuture[]
  createdAt: string
  lastUsedAt?: string
  userAgent?: string
  nickname?: string
  deviceType?: CredentialDeviceType
  backedUp?: boolean
}

/**
 * 臨時 Challenge 儲存（5 分鐘 TTL）
 */
export interface StoredChallenge {
  challenge: string
  type: 'registration' | 'authentication'
  createdAt: string
  username?: string
  expiresAt: string
}

/**
 * 使用者憑證索引
 */
export interface UserCredentialsIndex {
  credentialIDs: Base64URLString[]
}

/**
 * WebAuthn 配置
 */
export interface WebAuthnConfig {
  WEBAUTHN_RP_NAME: string
  WEBAUTHN_RP_ID: string
  WEBAUTHN_RP_ORIGINS: string[]
  WEBAUTHN_ATTESTATION: 'none' | 'indirect' | 'direct' | 'enterprise'
  WEBAUTHN_AUTHENTICATOR_ATTACHMENT?: 'platform' | 'cross-platform'
  WEBAUTHN_RESIDENT_KEY: 'required' | 'preferred' | 'discouraged'
  WEBAUTHN_USER_VERIFICATION: 'required' | 'preferred' | 'discouraged'
  WEBAUTHN_TIMEOUT: number
  WEBAUTHN_HINTS?: ('security-key' | 'client-device' | 'hybrid')[]
}
