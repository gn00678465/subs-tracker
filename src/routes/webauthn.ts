import type { HonoEnv } from '../types'
import type { StoredCredential } from '../types/webauthn'
import { Buffer } from 'node:buffer'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { authMiddleware } from '../middleware/auth'
import { getConfig } from '../services/config'
import {
  deleteCredential,
  extractRPID,
  getChallenge,
  getCredential,
  getUserCredentials,
  storeChallenge,
  storeCredential,
  updateCredentialCounter,
  updateCredentialNickname,
} from '../services/webauthn'
import { generateJWT, setTokenCookie } from '../utils/crypto'
import * as logger from '../utils/logger'
import { created, notFound, serverError, success, validationError } from '../utils/response'

const webauthn = new OpenAPIHono<HonoEnv>()

// ==================== 註冊端點 ====================

/**
 * POST /api/webauthn/register/options
 * 生成註冊選項（需認證）
 */
const registerOptionsRoute = createRoute({
  method: 'post',
  path: '/register/options',
  tags: ['WebAuthn'],
  summary: '生成 WebAuthn 註冊選項',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            options: z.any(),
          }),
        },
      },
      description: '註冊選項生成成功',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
      description: '未授權',
    },
  },
})

// @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
webauthn.openapi(registerOptionsRoute, async (c) => {
  const authResult = await authMiddleware(c, async () => {})
  if (authResult)
    return authResult

  try {
    const user = c.get('user')
    const config = await getConfig(c.env)

    // 取得已註冊的憑證（用於 excludeCredentials）
    const existingCreds = await getUserCredentials(user.username, c.env)

    const rpID = config.WEBAUTHN_RP_ID || extractRPID(c.req.header('origin'))

    const options = await generateRegistrationOptions({
      rpName: config.WEBAUTHN_RP_NAME || 'SubsTracker',
      rpID,
      userName: user.username,
      userDisplayName: user.username,
      attestationType: config.WEBAUTHN_ATTESTATION || 'none',
      authenticatorSelection: {
        authenticatorAttachment: config.WEBAUTHN_AUTHENTICATOR_ATTACHMENT,
        residentKey: config.WEBAUTHN_RESIDENT_KEY || 'preferred',
        userVerification: config.WEBAUTHN_USER_VERIFICATION || 'preferred',
      },
      excludeCredentials: existingCreds.map(cred => ({
        id: cred.credentialID,
        transports: cred.transports,
      })),
      timeout: config.WEBAUTHN_TIMEOUT || 60000,
    })

    // 儲存 challenge
    await storeChallenge(options.challenge, 'registration', c.env, user.username)

    return success(c, options)
  }
  catch (error) {
    logger.error('Failed to generate registration options', error, { prefix: 'WebAuthn' })
    return serverError(c, error instanceof Error ? error.message : '生成註冊選項失敗')
  }
})

/**
 * POST /api/webauthn/register/verify
 * 驗證註冊回應（需認證）
 */
const registerVerifyRoute = createRoute({
  method: 'post',
  path: '/register/verify',
  tags: ['WebAuthn'],
  summary: '驗證 WebAuthn 註冊回應',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.any(),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string().optional(),
          }),
        },
      },
      description: '註冊驗證成功',
    },
  },
})

// @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
webauthn.openapi(registerVerifyRoute, async (c) => {
  const authResult = await authMiddleware(c, async () => {})
  if (authResult)
    return authResult

  try {
    const user = c.get('user')
    const body = await c.req.json()
    const config = await getConfig(c.env)

    // 取得 challenge
    const storedChallenge = await getChallenge(body.response.clientDataJSON ? JSON.parse(Buffer.from(body.response.clientDataJSON, 'base64').toString()).challenge : body.challenge, c.env)

    if (!storedChallenge) {
      return validationError(c, 'Challenge 已過期或無效')
    }

    const rpID = config.WEBAUTHN_RP_ID || extractRPID(c.req.header('origin'))
    let expectedOrigin = config.WEBAUTHN_RP_ORIGINS
    if (!expectedOrigin || expectedOrigin.length === 0) {
      logger.warning('WEBAUTHN_RP_ORIGINS not configured, using request origin as fallback', {
        prefix: 'WebAuthn',
        data: { origin: c.req.header('origin') },
      })
      expectedOrigin = [c.req.header('origin') || '']
    }

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin,
      expectedRPID: rpID,
    })

    if (verification.verified && verification.registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo

      const storedCredential: StoredCredential = {
        credentialID: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        transports: body.response.transports,
        createdAt: new Date().toISOString(),
        userAgent: c.req.header('user-agent'),
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
      }

      await storeCredential(user.username, storedCredential, c.env)

      logger.info('WebAuthn registration successful', { prefix: 'WebAuthn', data: { username: user.username } })

      return success(c, null, 'Passkey 註冊成功')
    }

    return validationError(c, '註冊驗證失敗')
  }
  catch (error) {
    logger.error('Failed to verify registration', error, { prefix: 'WebAuthn' })
    return serverError(c, error instanceof Error ? error.message : '註冊驗證失敗')
  }
})

// ==================== 認證端點 ====================

/**
 * POST /api/webauthn/authenticate/options
 * 生成認證選項（公開）
 */
const authenticateOptionsRoute = createRoute({
  method: 'post',
  path: '/authenticate/options',
  tags: ['WebAuthn'],
  summary: '生成 WebAuthn 認證選項',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            username: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            options: z.any(),
          }),
        },
      },
      description: '認證選項生成成功',
    },
  },
})

// @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
webauthn.openapi(authenticateOptionsRoute, async (c) => {
  try {
    const { username } = await c.req.json()
    const config = await getConfig(c.env)

    const userCredentials = await getUserCredentials(username, c.env)

    if (userCredentials.length === 0) {
      return notFound(c, '此使用者尚未註冊 Passkey')
    }

    const rpID = config.WEBAUTHN_RP_ID || extractRPID(c.req.header('origin'))

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: userCredentials.map(cred => ({
        id: cred.credentialID,
        transports: cred.transports,
      })),
      timeout: config.WEBAUTHN_TIMEOUT || 60000,
      userVerification: config.WEBAUTHN_USER_VERIFICATION || 'preferred',
    })

    await storeChallenge(options.challenge, 'authentication', c.env, username)

    return success(c, options)
  }
  catch (error) {
    logger.error('Failed to generate authentication options', error, { prefix: 'WebAuthn' })
    return serverError(c, error instanceof Error ? error.message : '生成認證選項失敗')
  }
})

/**
 * POST /api/webauthn/authenticate/verify
 * 驗證認證回應並簽發 JWT（公開）
 */
const authenticateVerifyRoute = createRoute({
  method: 'post',
  path: '/authenticate/verify',
  tags: ['WebAuthn'],
  summary: '驗證 WebAuthn 認證回應',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.any(),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              username: z.string(),
            }).optional(),
            message: z.string().optional(),
          }),
        },
      },
      description: '認證成功',
    },
  },
})

// @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
webauthn.openapi(authenticateVerifyRoute, async (c) => {
  try {
    const body = await c.req.json()
    const config = await getConfig(c.env)

    // 從 response 中提取 challenge
    const clientDataJSON = JSON.parse(
      Buffer.from(body.response.clientDataJSON, 'base64').toString(),
    )
    const storedChallenge = await getChallenge(clientDataJSON.challenge, c.env)

    if (!storedChallenge || !storedChallenge.username) {
      return validationError(c, 'Challenge 已過期或無效')
    }

    const credential = await getCredential(body.id, c.env)

    if (!credential) {
      return notFound(c, '憑證不存在')
    }

    const rpID = config.WEBAUTHN_RP_ID || extractRPID(c.req.header('origin'))
    let expectedOrigin = config.WEBAUTHN_RP_ORIGINS
    if (!expectedOrigin || expectedOrigin.length === 0) {
      logger.warning('WEBAUTHN_RP_ORIGINS not configured, using request origin as fallback', {
        prefix: 'WebAuthn',
        data: { origin: c.req.header('origin') },
      })
      expectedOrigin = [c.req.header('origin') || '']
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: storedChallenge.challenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: credential.credentialID,
        publicKey: Buffer.from(credential.publicKey, 'base64url'),
        counter: credential.counter,
      },
    })

    if (verification.verified && verification.authenticationInfo) {
      // 更新 counter
      await updateCredentialCounter(
        credential.credentialID,
        verification.authenticationInfo.newCounter,
        c.env,
      )

      // 生成 JWT token
      const token = await generateJWT(storedChallenge.username, config.JWT_SECRET)
      setTokenCookie(c, token)

      logger.info('WebAuthn authentication successful', { prefix: 'WebAuthn', data: { username: storedChallenge.username } })

      return created(c, { username: storedChallenge.username }, '登入成功')
    }

    return validationError(c, '認證驗證失敗')
  }
  catch (error) {
    logger.error('Failed to verify authentication', error, { prefix: 'WebAuthn' })
    return serverError(c, error instanceof Error ? error.message : '認證驗證失敗')
  }
})

// ==================== 管理端點 ====================

/**
 * GET /api/webauthn/credentials
 * 列出使用者的所有憑證（需認證）
 */
const listCredentialsRoute = createRoute({
  method: 'get',
  path: '/credentials',
  tags: ['WebAuthn'],
  summary: '列出使用者的所有 Passkey',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: z.array(z.any()),
          }),
        },
      },
      description: '取得憑證列表成功',
    },
  },
})

// @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
webauthn.openapi(listCredentialsRoute, async (c) => {
  const authResult = await authMiddleware(c, async () => {})
  if (authResult)
    return authResult

  try {
    const user = c.get('user')
    const credentials = await getUserCredentials(user.username, c.env)

    // 移除敏感資訊（publicKey）
    const safeCredentials = credentials.map(({ publicKey, ...cred }) => cred)

    return success(c, safeCredentials)
  }
  catch (error) {
    logger.error('Failed to list credentials', error, { prefix: 'WebAuthn' })
    return serverError(c, error instanceof Error ? error.message : '取得憑證列表失敗')
  }
})

/**
 * DELETE /api/webauthn/credentials/:id
 * 刪除憑證（需認證）
 */
const deleteCredentialRoute = createRoute({
  method: 'delete',
  path: '/credentials/:id',
  tags: ['WebAuthn'],
  summary: '刪除 Passkey',
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
      description: '刪除成功',
    },
  },
})

// @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
webauthn.openapi(deleteCredentialRoute, async (c) => {
  const authResult = await authMiddleware(c, async () => {})
  if (authResult)
    return authResult

  try {
    const user = c.get('user')
    const credentialID = c.req.param('id')

    // 驗證所有權
    const userCreds = await getUserCredentials(user.username, c.env)
    if (!userCreds.find(cred => cred.credentialID === credentialID)) {
      return validationError(c, '無權限刪除此憑證')
    }

    await deleteCredential(credentialID, user.username, c.env)

    return success(c, undefined, 'Passkey 刪除成功')
  }
  catch (error) {
    logger.error('Failed to delete credential', error, { prefix: 'WebAuthn' })
    return serverError(c, error instanceof Error ? error.message : '刪除憑證失敗')
  }
})

/**
 * PUT /api/webauthn/credentials/:id
 * 更新憑證暱稱（需認證）
 */
const updateCredentialRoute = createRoute({
  method: 'put',
  path: '/credentials/:id',
  tags: ['WebAuthn'],
  summary: '更新 Passkey 暱稱',
  request: {
    params: z.object({
      id: z.string(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            nickname: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
      description: '更新成功',
    },
  },
})

// @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
webauthn.openapi(updateCredentialRoute, async (c) => {
  const authResult = await authMiddleware(c, async () => {})
  if (authResult)
    return authResult

  try {
    const user = c.get('user')
    const credentialID = c.req.param('id')
    const { nickname } = await c.req.json()

    // 驗證所有權
    const userCreds = await getUserCredentials(user.username, c.env)
    if (!userCreds.find(cred => cred.credentialID === credentialID)) {
      return validationError(c, '無權限更新此憑證')
    }

    await updateCredentialNickname(credentialID, nickname, c.env)

    return success(c, undefined, '暱稱更新成功')
  }
  catch (error) {
    logger.error('Failed to update credential nickname', error, { prefix: 'WebAuthn' })
    return serverError(c, error instanceof Error ? error.message : '更新暱稱失敗')
  }
})

export default webauthn
