import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'

import { optionalAuthMiddleware } from './middleware/auth'
import { createOpenAPIApp } from './openapi'
import { LoginPage } from './pages/Login'
import { renderer } from './renderer'
import auth from './routes/auth'
import settings from './routes/settings'
import subscriptions from './routes/subscriptions'
import webauthn from './routes/webauthn'
import { runReminders } from './services/subscription_cron'
import type { Bindings } from './types'

// 使用支持 OpenAPI 的 Hono 實例
const app = createOpenAPIApp()

// 全局 middleware
app.use(logger())
app.use(prettyJSON())
app.use(renderer)

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
app.get('/', optionalAuthMiddleware, (c) => {
  const user = c.get('user')

  if (user) {
    // 已登入，重定向到管理頁面
    return c.redirect('/admin')
  }

  // 未登入，渲染登入頁
  return c.html(<LoginPage />)
})

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    ctx.waitUntil(runReminders(env, new Date()))
  },
}
