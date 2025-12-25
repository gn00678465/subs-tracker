import type { Bindings } from './types'
import { swaggerUI } from '@hono/swagger-ui'
import { OpenAPIHono } from '@hono/zod-openapi'

/**
 * 創建支持 OpenAPI 的 Hono 實例
 */
export function createOpenAPIApp() {
  const app = new OpenAPIHono<{ Bindings: Bindings }>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json({
          success: false,
          message: '請求驗證失敗',
          errors: result.error.issues.map(err => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        }, 400)
      }
    },
  })

  // Swagger UI 路由
  app.get('/ui', swaggerUI({
    url: '/doc',
  }))

  // OpenAPI JSON 文檔
  app.doc('/doc', {
    openapi: '3.1.0',
    info: {
      version: '1.0.0',
      title: 'SubsTracker API',
      description: '訂閱管理與提醒系統 API 文檔',
    },
    servers: [
      {
        url: 'http://localhost:5173',
        description: '本地開發環境',
      },
      {
        url: 'https://subscription-manager.workers.dev',
        description: '生產環境',
      },
    ],
    tags: [
      {
        name: 'Auth',
        description: '認證相關 API',
      },
      {
        name: 'Subscriptions',
        description: '訂閱管理 API',
      },
      {
        name: 'Config',
        description: '系統配置 API',
      },
      {
        name: 'Notify',
        description: '第三方通知 API',
      },
    ],
  })

  return app
}
