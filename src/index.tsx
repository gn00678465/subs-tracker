import type { Bindings } from './types'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { optionalAuthMiddleware, pageAuthMiddleware } from './middleware/auth'
import { createOpenAPIApp } from './openapi'
import { AdminPage } from './pages/Admin'
import { ConfigPage } from './pages/Config'
import { LoginPage } from './pages/Login'
import { renderer } from './renderer'
import auth from './routes/auth'
import config from './routes/config'
import notify from './routes/notify'
import subscriptions from './routes/subscriptions'

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

// 掛載配置路由
app.route('/api/config', config)

// 掛載第三方通知路由（無需認證，使用 API Token）
app.route('/api/notify', notify)

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

// 配置頁面路由
app.get('/admin/config', pageAuthMiddleware, (c) => {
  const user = c.get('user')
  return c.html(<ConfigPage username={user.username} />)
})

// 管理頁面路由
app.get('/admin', pageAuthMiddleware, (c) => {
  const user = c.get('user')
  return c.html(<AdminPage username={user.username} />)
})

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    // TODO: Phase 7 - 實現定時任務邏輯
    console.log('[Cron] Scheduled task triggered at:', new Date().toISOString())
  },
}
