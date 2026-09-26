import { Buffer } from 'node:buffer'

import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server'
import { isoCBOR } from '@simplewebauthn/server/helpers'

const FLAG_UP = 0x01
const FLAG_UV = 0x04
const FLAG_BE = 0x08
const FLAG_BS = 0x10
const FLAG_AT = 0x40

const b64url = (bytes: Uint8Array | ArrayBuffer) => Buffer.from(new Uint8Array(bytes)).toString('base64url')

async function sha256(data: Uint8Array<ArrayBuffer> | string): Promise<Uint8Array<ArrayBuffer>> {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data
  return new Uint8Array(await crypto.subtle.digest('SHA-256', input))
}

// WebCrypto 產生 r||s；WebAuthn 的 ES256 簽章要 ASN.1 DER
function derSignature(raw: Uint8Array): Uint8Array {
  const integer = (bytes: Uint8Array) => {
    let start = 0
    while (start < bytes.length - 1 && bytes[start] === 0) start++
    const trimmed = bytes.slice(start)
    const body = trimmed[0] & 0x80 ? Uint8Array.of(0, ...trimmed) : trimmed
    return Uint8Array.of(0x02, body.length, ...body)
  }
  const r = integer(raw.slice(0, 32))
  const s = integer(raw.slice(32))
  return Uint8Array.of(0x30, r.length + s.length, ...r, ...s)
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(parts.flatMap((part) => [...part]))
}

/** 測試用的軟體驗證器：P-256 金鑰、none attestation、可同步（BE/BS） */
export class SoftAuthenticator {
  private counter = 0

  private constructor(
    private readonly keys: CryptoKeyPair,
    readonly credentialId: Uint8Array,
    private readonly aaguid: Uint8Array,
    private userHandle = '',
  ) {}

  static async create(aaguid = '00000000-0000-0000-0000-000000000000'): Promise<SoftAuthenticator> {
    const keys = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair
    return new SoftAuthenticator(
      keys,
      crypto.getRandomValues(new Uint8Array(16)),
      Uint8Array.from(Buffer.from(aaguid.replaceAll('-', ''), 'hex')),
    )
  }

  get id(): string {
    return b64url(this.credentialId)
  }

  private async authenticatorData(rpId: string, flags: number, attested?: Uint8Array): Promise<Uint8Array> {
    this.counter++
    const count = new Uint8Array(4)
    new DataView(count.buffer).setUint32(0, this.counter)
    return concat(await sha256(rpId), Uint8Array.of(flags), count, attested ?? new Uint8Array())
  }

  async register(options: PublicKeyCredentialCreationOptionsJSON, origin: string): Promise<RegistrationResponseJSON> {
    this.userHandle = options.user.id
    const jwk = await crypto.subtle.exportKey('jwk', this.keys.publicKey)
    const coseKey = isoCBOR.encode(
      new Map<number, number | Uint8Array>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, Buffer.from(jwk.x as string, 'base64url')],
        [-3, Buffer.from(jwk.y as string, 'base64url')],
      ]),
    )
    const idLength = Uint8Array.of(0, this.credentialId.length)
    const attested = concat(this.aaguid, idLength, this.credentialId, coseKey)
    const authData = await this.authenticatorData(
      options.rp.id ?? new URL(origin).hostname,
      FLAG_UP | FLAG_UV | FLAG_BE | FLAG_BS | FLAG_AT,
      attested,
    )
    const clientDataJSON = JSON.stringify({ type: 'webauthn.create', challenge: options.challenge, origin })
    const attestationObject = isoCBOR.encode(
      new Map<string, string | Uint8Array | Map<string, string>>([
        ['fmt', 'none'],
        ['attStmt', new Map<string, string>()],
        ['authData', authData],
      ]),
    )
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: {
        clientDataJSON: b64url(new TextEncoder().encode(clientDataJSON)),
        attestationObject: b64url(attestationObject),
        transports: ['internal'],
      },
      clientExtensionResults: {},
    }
  }

  async authenticate(
    options: PublicKeyCredentialRequestOptionsJSON,
    origin: string,
  ): Promise<AuthenticationResponseJSON> {
    const authData = await this.authenticatorData(
      options.rpId ?? new URL(origin).hostname,
      FLAG_UP | FLAG_UV | FLAG_BE | FLAG_BS,
    )
    const clientData = new TextEncoder().encode(
      JSON.stringify({ type: 'webauthn.get', challenge: options.challenge, origin }),
    )
    const signed = concat(authData, await sha256(clientData))
    const raw = new Uint8Array(
      await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, this.keys.privateKey, signed),
    )
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: {
        clientDataJSON: b64url(clientData),
        authenticatorData: b64url(authData),
        signature: b64url(derSignature(raw)),
        userHandle: this.userHandle || undefined,
      },
      clientExtensionResults: {},
    }
  }
}
