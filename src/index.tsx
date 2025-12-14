import type { Bindings } from './types'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { createOpenAPIApp } from './openapi'
import auth from './routes/auth'
import config from './routes/config'
import notify from './routes/notify'
import subscriptions from './routes/subscriptions'

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

// 掛載配置路由
app.route('/api/config', config)

// 掛載第三方通知路由（無需認證，使用 API Token）
app.route('/api/notify', notify)

app.get('/', (c) => {
  return c.text('SubsTracker - Refactored with Hono')
})

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    // TODO: Phase 7 - 實現定時任務邏輯
    console.log('[Cron] Scheduled task triggered at:', new Date().toISOString())
  },
}
