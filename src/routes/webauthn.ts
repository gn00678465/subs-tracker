import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import type { Context } from 'hono'

import { authMiddleware, recentAuthMiddleware } from '../middleware/auth'
import {
  authenticationOptions,
  deletePasskeyById,
  listPasskeyViews,
  registrationOptions,
  relyingParty,
  renamePasskeyById,
  verifyAuthentication,
  verifyRegistration,
} from '../services/passkey'
import { loadSettings } from '../services/settings'
import type { HonoEnv } from '../types'
import { generateJWT, setTokenCookie } from '../utils/crypto'
import { UserError } from '../utils/errors'
import * as logger from '../utils/logger'
import { created, notFound, serverError, success, validationError } from '../utils/response'

const webauthn = new OpenAPIHono<HonoEnv>()

// 登入（/authenticate/*）不需要登入狀態；新增與刪除 passkey 要在 10 分鐘內登入過，改名不需要
webauthn.use('/register/*', authMiddleware, recentAuthMiddleware)
webauthn.use('/credentials/*', authMiddleware)
webauthn.on('DELETE', '/credentials/:id', recentAuthMiddleware)

const ErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  code: z.string().optional(),
})

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
})

const okResponse = <T extends z.ZodType>(data: T, description: string) =>
  json(z.object({ success: z.literal(true), data, message: z.string().optional() }), description)

const messageResponse = (description: string) =>
  json(z.object({ success: z.literal(true), message: z.string() }), description)

const errorResponses = {
  400: json(ErrorResponseSchema, '驗證失敗或逾時'),
  401: json(ErrorResponseSchema, '沒有登入'),
  403: json(ErrorResponseSchema, '需要重新驗證（code: REAUTH_REQUIRED）'),
  500: json(ErrorResponseSchema, '伺服器錯誤'),
}

// 瀏覽器產生的回應由 @simplewebauthn/server 驗證；這裡只確認取得 challenge 需要的欄位
const credentialResponseSchema = z
  .object({ id: z.string(), response: z.object({ clientDataJSON: z.string() }).passthrough() })
  .passthrough()

const optionsSchema = z.object({}).passthrough().openapi({ description: 'WebAuthn options JSON' })

const passkeySchema = z
  .object({
    id: z.string(),
    nickname: z.string().nullable(),
    provider: z.string().nullable(),
    createdAt: z.string(),
    lastUsedAt: z.string().nullable(),
    synced: z.boolean().nullable(),
    usableHere: z.boolean(),
  })
  .openapi('Passkey')

const idParam = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})

function handleError(c: Context<HonoEnv>, error: unknown, action: string): Response {
  if (error instanceof UserError) return validationError(c, error.message)
  logger.error(`${action}失敗`, error, { prefix: 'WebAuthn' })
  return serverError(c, `${action}失敗`)
}

webauthn.openapi(
  createRoute({
    method: 'post',
    path: '/register/options',
    tags: ['WebAuthn'],
    summary: '新增 passkey：取得註冊選項',
    responses: { 200: okResponse(optionsSchema, '註冊選項'), ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      return success(c, await registrationOptions(c.env, relyingParty(c.req.url)))
    } catch (error) {
      return handleError(c, error, '產生註冊選項')
    }
  },
)

webauthn.openapi(
  createRoute({
    method: 'post',
    path: '/register/verify',
    tags: ['WebAuthn'],
    summary: '新增 passkey：驗證並儲存',
    request: { body: { content: { 'application/json': { schema: credentialResponseSchema } } } },
    responses: { 201: okResponse(passkeySchema, '已新增'), ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      const passkey = await verifyRegistration(
        c.env,
        relyingParty(c.req.url),
        c.req.valid('json') as unknown as RegistrationResponseJSON,
        c.req.header('user-agent') ?? null,
      )
      return created(c, passkey, '已新增 passkey')
    } catch (error) {
      return handleError(c, error, '新增 passkey')
    }
  },
)

webauthn.openapi(
  createRoute({
    method: 'post',
    path: '/authenticate/options',
    tags: ['WebAuthn'],
    summary: 'passkey 登入：取得驗證選項',
    description:
      '`conditional: true` 給登入頁的自動填入使用，不列出憑證。已登入時完成 passkey 登入，也用來重新驗證身分。',
    request: {
      body: { content: { 'application/json': { schema: z.object({ conditional: z.boolean().default(false) }) } } },
    },
    responses: { 200: okResponse(optionsSchema, '驗證選項'), ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      const { conditional } = c.req.valid('json')
      return success(c, await authenticationOptions(c.env, relyingParty(c.req.url), { conditional }))
    } catch (error) {
      return handleError(c, error, '產生驗證選項')
    }
  },
)

webauthn.openapi(
  createRoute({
    method: 'post',
    path: '/authenticate/verify',
    tags: ['WebAuthn'],
    summary: 'passkey 登入：驗證並登入',
    request: { body: { content: { 'application/json': { schema: credentialResponseSchema } } } },
    responses: { 201: okResponse(z.object({ username: z.string() }), '登入成功'), ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      const username = await verifyAuthentication(
        c.env,
        relyingParty(c.req.url),
        c.req.valid('json') as unknown as AuthenticationResponseJSON,
      )
      setTokenCookie(c, await generateJWT(username, (await loadSettings(c.env)).jwtSecret))
      return created(c, { username }, '登入成功')
    } catch (error) {
      return handleError(c, error, 'passkey 登入')
    }
  },
)

webauthn.openapi(
  createRoute({
    method: 'get',
    path: '/credentials',
    tags: ['WebAuthn'],
    summary: '列出 passkey',
    responses: { 200: okResponse(z.array(passkeySchema), 'passkey 清單'), ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      return success(c, await listPasskeyViews(c.env, relyingParty(c.req.url)))
    } catch (error) {
      return handleError(c, error, '讀取 passkey')
    }
  },
)

webauthn.openapi(
  createRoute({
    method: 'put',
    path: '/credentials/{id}',
    tags: ['WebAuthn'],
    summary: '修改 passkey 名稱',
    description: '空白名稱代表恢復預設名稱。',
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: z.object({ nickname: z.string().max(64) }) } } },
    },
    responses: { 200: messageResponse('已儲存'), 404: json(ErrorResponseSchema, 'passkey 不存在'), ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      const renamed = await renamePasskeyById(c.env, c.req.valid('param').id, c.req.valid('json').nickname)
      return renamed ? success(c, undefined, '已儲存') : notFound(c, 'passkey 不存在')
    } catch (error) {
      return handleError(c, error, '修改 passkey 名稱')
    }
  },
)

webauthn.openapi(
  createRoute({
    method: 'delete',
    path: '/credentials/{id}',
    tags: ['WebAuthn'],
    summary: '刪除 passkey',
    request: { params: idParam },
    responses: { 200: messageResponse('已刪除'), 404: json(ErrorResponseSchema, 'passkey 不存在'), ...errorResponses },
  }),
  // @ts-expect-error - Response helper functions are runtime-compatible with OpenAPI typed responses
  async (c) => {
    try {
      const deleted = await deletePasskeyById(c.env, c.req.valid('param').id)
      return deleted ? success(c, undefined, '已刪除') : notFound(c, 'passkey 不存在')
    } catch (error) {
      return handleError(c, error, '刪除 passkey')
    }
  },
)

export default webauthn
