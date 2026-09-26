import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

import { optionalAuthMiddleware } from './middleware/auth'
import { createOpenAPIApp } from './openapi'
import { LoginPage } from './pages/Login'
import auth from './routes/auth'
import settings from './routes/settings'
import subscriptions from './routes/subscriptions'
import webauthn from './routes/webauthn'
import { listPasskeyViews, relyingParty } from './services/passkey'
import { loadSettings } from './services/settings'
import { runReminders } from './services/subscription_cron'
import type { Bindings } from './types'

// 使用支持 OpenAPI 的 Hono 實例
const app = createOpenAPIApp()

// 全局 middleware
app.use(logger())
app.use(prettyJSON())

// API 路由使用 CORS，不使用 CSRF（JWT 已提供保護）
app.use('/api/*', cors())

// 前端頁面路由使用 CSRF 保護（表單提交）
app.use('/admin/*', csrf())

// 掛載認證路由
app.route('/api', auth)

// 掛載訂閱路由
app.route('/api/subscriptions', subscriptions)

// 掛載設定路由
app.route('/api/settings', settings)

// 掛載 WebAuthn 路由
app.route('/api/webauthn', webauthn)

// 登入頁面路由
app.get('/', optionalAuthMiddleware, async (c) => {
  if (c.get('user')) return c.redirect('/admin')
  // 舊版的 passkey 在第一次讀取設定時匯入
  await loadSettings(c.env)
  const passkeys = await listPasskeyViews(c.env, relyingParty(c.req.url))
  return c.html(<LoginPage hasPasskey={passkeys.some((passkey) => passkey.usableHere)} />)
})

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(runReminders(env, new Date()))
  },
}
