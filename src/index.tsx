import type { Bindings, Subscription } from './types'
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
import { getConfig, isNotificationAllowedAtHour } from './services/config'
import { batchUpdateSubscriptions, getAllSubscriptions } from './services/subscription'
import { processSubscriptionReminder } from './services/subscription_cron'
import * as loggerUtil from './utils/logger'
import { getCurrentTime } from './utils/time'

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
    loggerUtil.info('[Cron] 定時任務開始', {
      prefix: 'Cron',
      data: { triggerTime: new Date().toISOString() },
    })

    try {
      // 1. 獲取配置
      const config = await getConfig(env)

      // 2. 檢查通知時段（UTC）
      const currentHour = new Date().getUTCHours()
      if (!isNotificationAllowedAtHour(config, currentHour)) {
        loggerUtil.info(`[Cron] 當前時段 UTC ${currentHour}時 不在允許範圍，跳過`, {
          prefix: 'Cron',
          data: { allowedHours: config.NOTIFICATION_HOURS },
        })
        return
      }

      // 3. 獲取所有訂閱
      const subscriptions = await getAllSubscriptions(env)
      loggerUtil.info(`[Cron] 獲取到 ${subscriptions.length} 個訂閱`, { prefix: 'Cron' })

      if (subscriptions.length === 0) {
        loggerUtil.info('[Cron] 沒有訂閱需要檢查', { prefix: 'Cron' })
        return
      }

      // 4. 並行處理所有訂閱（僅讀取和計算，不寫入 KV）
      const currentTime = getCurrentTime()
      const processPromises = subscriptions.map(sub =>
        processSubscriptionReminder(sub, currentTime, config),
      )

      const results = await Promise.allSettled(processPromises)

      // 5. 收集需要更新的訂閱
      const subscriptionUpdates = new Map<string, Subscription>()

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.updatedSubscription) {
          const { updatedSubscription } = result.value
          subscriptionUpdates.set(updatedSubscription.id, updatedSubscription)
        }
      })

      // 6. 原子批量更新（單次 KV 寫入，消除競爭條件）
      if (subscriptionUpdates.size > 0) {
        const updateResult = await batchUpdateSubscriptions(subscriptionUpdates, env)
        if (!updateResult.success) {
          loggerUtil.error('[Cron] 批量更新訂閱失敗', new Error(updateResult.message || '未知錯誤'), {
            prefix: 'Cron',
          })
        }
        else {
          loggerUtil.info(`[Cron] 成功更新 ${updateResult.updatedCount} 個訂閱`, { prefix: 'Cron' })
        }
      }

      // 7. 統計結果
      const stats = {
        total: subscriptions.length,
        processed: 0,
        reminded: 0,
        renewed: 0,
        skipped: 0,
        failed: 0,
      }

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { action, success } = result.value
          if (success) {
            stats.processed++
            if (action === 'reminded')
              stats.reminded++
            else if (action === 'renewed')
              stats.renewed++
            else if (action === 'skipped')
              stats.skipped++
          }
          else {
            stats.failed++
          }
        }
        else {
          stats.failed++
          loggerUtil.error(`[Cron] 處理失敗: ${subscriptions[index].name}`, result.reason, {
            prefix: 'Cron',
          })
        }
      })

      loggerUtil.info('[Cron] 定時任務執行完成', {
        prefix: 'Cron',
        data: stats,
      })
    }
    catch (error) {
      loggerUtil.error('[Cron] 定時任務執行失敗', error, { prefix: 'Cron' })
    }
  },
}
