import type { Bindings } from './types'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { csrf } from 'hono/csrf'

const app = new Hono<{ Bindings: Bindings }>()

app.use(csrf())
app.use('/api/*', cors())

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
