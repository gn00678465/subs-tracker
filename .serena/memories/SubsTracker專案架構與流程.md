# SubsTracker 專案結構與流程深度分析

## 📌 專案概述

**SubsTracker** 是一個基於 Cloudflare Workers 的訂閱管理與提醒系統，提供訂閱服務追蹤、到期提醒，以及多渠道通知功能。

### 核心技術棧
- **平台**: Cloudflare Workers (Serverless)
- **框架**: Hono (HTTP 框架)
- **構建工具**: Vite + TypeScript
- **存儲**: Cloudflare KV (鍵值存儲)
- **前端**: Vanilla TypeScript + htmx + Tailwind CSS v4
- **定時任務**: Cloudflare Cron Triggers
- **包管理**: bun

---

## 🏗️ 專案架構（已重構）

### 檔案結構
```
src/
├── index.tsx              # Worker 主入口 + 路由分發
├── global.d.ts            # 全局類型定義
├── openapi.ts             # OpenAPI 文檔生成
├── renderer.tsx           # 頁面渲染工具
├── style.css              # Tailwind 全局樣式
│
├── client/                # 前端客戶端邏輯
│   ├── icons.ts           # 圖標常數
│   ├── admin/             # 管理面板客戶端
│   │   ├── index.ts       # 訂閱列表邏輯
│   │   ├── subscriptionModal.ts  # 模態框交互
│   │   └── tableRenderer.tsx     # 表格渲染
│   └── config/            # 配置頁客戶端
│       └── index.ts
│
├── components/            # UI 組件
│   ├── Avatar.tsx
│   ├── Layout.tsx
│   ├── Navbar.tsx
│   ├── ToggleTheme.tsx
│   └── admin/
│       ├── SubscriptionModal.tsx      # 訂閱編輯模態框
│       ├── SubscriptionTable.tsx      # 訂閱列表表格
│       ├── SubscriptionTableRow.tsx   # 單行訂閱
│       ├── SubscriptionTableStates.tsx # 狀態管理
│       └── utils.ts                   # 組件工具函數
│
├── middleware/            # Hono 中間件
│   └── auth.ts           # JWT 認證中間件
│
├── pages/                # 頁面組件
│   ├── Admin.tsx         # 訂閱列表管理頁面
│   ├── Config.tsx        # 系統配置頁面
│   └── Login.tsx         # 登入頁面
│
├── routes/               # Hono 路由處理器
│   ├── auth.ts           # 認證路由 (/auth/*)
│   ├── config.ts         # 配置路由 (/config/*)
│   ├── notify.ts         # 通知路由 (/notify/*)
│   └── subscriptions.ts  # 訂閱 API (/subscriptions/*)
│
├── services/             # 業務邏輯層
│   ├── config.ts         # 配置管理
│   ├── subscription.ts   # 訂閱 CRUD 操作
│   ├── subscription_cron.ts  # 定時任務處理
│   └── notifier/         # 通知系統
│       ├── index.ts      # 通知協調器
│       ├── types.ts      # 通知類型定義
│       ├── channels/     # 通知渠道實現
│       │   ├── telegram.ts   # Telegram Bot
│       │   ├── bark.ts       # Bark 推送
│       │   ├── resend.ts     # Resend 郵件
│       │   └── webhook.ts    # 自定義 Webhook
│       └── utils/
│           └── template.ts   # 通知模板引擎
│
├── types/                # TypeScript 類型定義
│   ├── api.d.ts          # API 請求/響應類型
│   ├── error.ts          # 錯誤類型
│   ├── htmx.d.ts         # htmx 類型
│   └── index.ts          # 訂閱、配置等主要類型
│
└── utils/                # 工具函數
    ├── circularReveal.ts # 動畫工具
    ├── confirmDialog.ts  # 確認對話框
    ├── constants.ts      # 常數定義
    ├── crypto.ts         # 加密工具
    ├── formAdaptor.ts    # 表單適配器
    ├── logger.ts         # 日誌工具
    ├── response.ts       # 響應構建
    ├── themeToggle.ts    # 主題切換
    ├── time.ts           # 時間工具
    └── toast.ts          # Toast 通知
```

### 核心模組划分

#### 1. **路由層** (Hono routes)

**認證路由** [`src/routes/auth.ts`](src/routes/auth.ts)
- `POST /auth/login` - 用戶登入 (username/password)
- `GET /auth/logout` - 登出

**訂閱 API** [`src/routes/subscriptions.ts`](src/routes/subscriptions.ts)
- `GET /api/subscriptions` - 獲取所有訂閱
- `POST /api/subscriptions` - 創建訂閱
- `PUT /api/subscriptions/:id` - 更新訂閱
- `DELETE /api/subscriptions/:id` - 刪除訂閱
- `PUT /api/subscriptions/:id/status` - 切換啟用/停用
- `POST /api/subscriptions/:id/test` - 測試通知

**配置路由** [`src/routes/config.ts`](src/routes/config.ts)
- `GET /api/config` - 獲取配置
- `PUT /api/config` - 更新配置

**通知路由** [`src/routes/notify.ts`](src/routes/notify.ts)
- `POST /api/notify/:token` - 第三方 API 觸發通知

#### 2. **服務層** (Business Logic)

**訂閱服務** [`src/services/subscription.ts`](src/services/subscription.ts)
- `getAllSubscriptions(env)` - 獲取所有訂閱
- `getSubscription(id, env)` - 獲取單個訂閱
- `createSubscription(data, env)` - 創建訂閱
- `updateSubscription(id, data, env)` - 更新訂閱
- `deleteSubscription(id, env)` - 刪除訂閱
- `toggleSubscriptionStatus(id, status, env)` - 切換狀態

**定時任務** [`src/services/subscription_cron.ts`](src/services/subscription_cron.ts)
```typescript
processSubscriptionReminder(env): 
  1. 獲取所有啟用訂閱
  2. 計算剩餘時間
  3. 檢查是否觸發提醒條件
  4. 檢查時間窗口限制 (NOTIFICATION_HOURS)
  5. 執行自動續期
  6. 發送通知
  7. 批量更新 KV
```

**配置管理** [`src/services/config.ts`](src/services/config.ts)
- KV 配置持久化
- 默認配置合併

**通知協調器** [`src/services/notifier/index.ts`](src/services/notifier/index.ts)
- 並行發送到多個渠道
- 使用 `Promise.allSettled()` 確保不互相影響

#### 3. **通知渠道** (Notification Channels)

**4 個實裝通知渠道**：

1. **Telegram** [`src/services/notifier/channels/telegram.ts`](src/services/notifier/channels/telegram.ts)
   - 支持 Markdown 格式
   - 禁用網頁預覽

2. **Bark** [`src/services/notifier/channels/bark.ts`](src/services/notifier/channels/bark.ts)
   - iOS 推送通知
   - 支持自建服務器

3. **Resend** [`src/services/notifier/channels/resend.ts`](src/services/notifier/channels/resend.ts)
   - HTML 郵件發送
   - 支持自定義發件人/收件人

4. **Webhook** [`src/services/notifier/channels/webhook.ts`](src/services/notifier/channels/webhook.ts)
   - 自定義 URL/Method/Headers
   - 模板引擎支持 ({{title}}, {{content}}, {{tags}})

#### 4. **前端組件層** (UI Components)

**頁面組件**:
- [`src/pages/Login.tsx`](src/pages/Login.tsx) - 登入頁面
- [`src/pages/Admin.tsx`](src/pages/Admin.tsx) - 訂閱列表
- [`src/pages/Config.tsx`](src/pages/Config.tsx) - 系統配置

**管理面板組件**:
- [`src/components/admin/SubscriptionTable.tsx`](src/components/admin/SubscriptionTable.tsx) - 訂閱表格
- [`src/components/admin/SubscriptionModal.tsx`](src/components/admin/SubscriptionModal.tsx) - 編輯模態框
- [`src/components/admin/SubscriptionTableRow.tsx`](src/components/admin/SubscriptionTableRow.tsx) - 單行訂閱

**客戶端互動**:
- [`src/client/admin/index.ts`](src/client/admin/index.ts) - 訂閱列表邏輯
- [`src/client/admin/subscriptionModal.ts`](src/client/admin/subscriptionModal.ts) - 模態框交互
- [`src/utils/formAdaptor.ts`](src/utils/formAdaptor.ts) - 表單數據適配

---

## 📊 訂閱數據結構

```typescript
interface Subscription {
  id: string                    // UUID
  name: string                  // 訂閱名稱
  customType: string            // 類型 (流媒體/雲服務/軟件)
  category: string              // 分類 (個人/家庭/公司)
  expiryDate: string            // 到期日期 (YYYY-MM-DD)
  autoRenew: boolean            // 自動續期
  periodValue: number           // 周期值
  periodUnit: 'day'|'month'|'year'  // 周期單位
  reminderUnit: 'day'|'hour'    // 提醒單位
  reminderValue: number         // 提醒提前值
  notes: string                 // 備註
  isActive: boolean             // 是否啟用
  createdAt: string             // 創建時間 (ISO 8601)
  updatedAt: string             // 更新時間 (ISO 8601)
}
```

---

## ⚙️ 配置管理

**配置項類型** [`src/types/index.ts`](src/types/index.ts):

```typescript
interface SystemConfig {
  // 認證
  ADMIN_USERNAME: string
  ADMIN_PASSWORD: string  // 加密存儲
  JWT_SECRET: string
  API_TOKEN: string
  
  // 通知時間控制
  TIMEZONE: string  // 時區 (e.g., "Asia/Shanghai")
  NOTIFICATION_HOURS: string[]  // 允許通知的小時 (0-23)
  
  // Telegram
  TELEGRAM_BOT_TOKEN?: string
  TELEGRAM_CHAT_ID?: string
  
  // Bark
  BARK_SERVER?: string
  BARK_DEVICE_KEY?: string
  BARK_SAVE?: boolean
  
  // Resend
  RESEND_API_KEY?: string
  RESEND_FROM?: string
  RESEND_TO?: string
  
  // Webhook
  WEBHOOK_URL?: string
  WEBHOOK_METHOD?: 'POST'|'PUT'|'PATCH'
  WEBHOOK_HEADERS?: Record<string, string>
}
```

---

## 🔄 核心業務流程

### 1. 用戶登入流程
```
訪問 https://domain/
  → 顯示登入頁 (Login.tsx)
  → POST /auth/login { username, password }
  → 驗證用戶名/密碼 (config.ADMIN_USERNAME/PASSWORD)
  → 密碼校驗: HMAC-SHA256(password, JWT_SECRET)
  → 生成 JWT Token (exp: 7 days)
  → Set-Cookie: token=xxx (HttpOnly)
  → 重定向到 /admin
```

### 2. 訂閱列表渲染流程
```
訪問 /admin
  → 驗證 JWT Token (auth middleware)
  → 渲染 Admin.tsx
  → 前端 (src/client/admin/index.ts):
    → GET /api/subscriptions
    → 接收訂閱列表
    → 計算剩餘天數
    → 排序 (按到期時間升序)
    → 渲染表格 (SubscriptionTable.tsx)
```

### 3. 創建/編輯訂閱流程
```
點擊「添加」或「編輯」
  → 顯示模態框 (SubscriptionModal.tsx)
  → 表單填寫:
    - 訂閱名稱
    - 類型/分類
    - 到期日期
    - 續期周期
    - 提醒時間
    - 備註
  → 點擊「保存」
    → POST/PUT /api/subscriptions
    → 服務層驗證數據
    → 保存到 KV
    → 刷新列表
```

### 4. 自動續期邏輯
```
定時任務觸發 (subscription_cron.ts):
  → 訂閱到期 AND autoRenew = true
  → 計算新到期日期:
    expiryDate = new Date(expiryDate) + (periodValue * periodUnit)
  → 更新訂閱
  → 返回待續期訂閱列表
```

### 5. 定時任務執行流程 (Cron Handler)
```
Cron 觸發 (每日設定時間，e.g., 0 8 * * *)
  → Worker scheduled() 事件
  → 執行 processSubscriptionReminder(env)
  
  流程:
  1. 獲取系統配置 (TIMEZONE, NOTIFICATION_HOURS)
  2. 檢查當前小時是否在允許範圍
     → 不在: 跳過本次通知
  3. 獲取所有訂閱
  4. 過濾 isActive = true
  5. 遍歷每個訂閱:
     - 計算 daysDiff 和 hoursDiff
     - 檢查是否觸發提醒:
       shouldTriggerReminder(reminderUnit, reminderValue, diff)
     - 如果觸發 AND autoRenew:
       → 執行續期計算
       → 標記待更新
  6. 批量更新 KV (Promise.allSettled)
  7. 收集通知內容
  8. 並行發送到所有啟用渠道:
     → sendNotificationToAllChannels()
     → Promise.allSettled() 調用各渠道
```

### 6. 多渠道通知發送
```
sendNotificationToAllChannels(title, content, config):
  → 並行執行:
    [ Promise.allSettled([
        sendTelegramNotification(),
        sendBarkNotification(),
        sendResendEmail(),
        sendWebhookNotification()
      ])
    ]
  → 記錄各渠道成功/失敗
  → 返回結果摘要
```

---

## 🔐 安全機制

### 1. JWT 認證
- **生成**: 登入成功後生成 (payload: {username, exp})
- **驗證**: 所有受保護路由使用 auth middleware
- **存儲**: HttpOnly Cookie (防止 XSS)
- **密鑰**: config.JWT_SECRET (首次啟動隨機生成)
- **過期**: 7 天

### 2. 密碼加密
- **算法**: HMAC-SHA256
- **鹽值**: JWT_SECRET
- **實現**: Web Crypto API (crypto.subtle)

### 3. 第三方 API 令牌
- **字段**: config.API_TOKEN
- **驗證方式**:
  - URL 參數: `?token=xxx`
  - Authorization Header: `Bearer xxx`
- **用途**: `/api/notify/:token` 端點

---

## 📦 數據存儲 (Cloudflare KV)

### KV 命名空間綁定
```typescript
interface CloudflareBindings {
  SUBSCRIPTIONS_KV: KVNamespace
}
```

### KV 存儲結構
```javascript
// Key: 'config'
{
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'hashed_password',
  JWT_SECRET: 'random_string',
  API_TOKEN: 'api_token_string',
  TIMEZONE: 'Asia/Shanghai',
  NOTIFICATION_HOURS: '0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23',
  TELEGRAM_BOT_TOKEN: 'xxx',
  TELEGRAM_CHAT_ID: 'xxx',
  BARK_SERVER: 'https://bark.example.com',
  BARK_DEVICE_KEY: 'xxx',
  RESEND_API_KEY: 'xxx',
  RESEND_FROM: 'noreply@example.com',
  RESEND_TO: 'user@example.com',
  WEBHOOK_URL: 'https://example.com/webhook',
  WEBHOOK_METHOD: 'POST',
  WEBHOOK_HEADERS: '{"Authorization":"Bearer xxx"}'
}

// Key: 'subscriptions'
[
  {
    id: 'uuid-1',
    name: 'Netflix',
    customType: '流媒體',
    category: '個人',
    expiryDate: '2025-12-31',
    autoRenew: true,
    periodValue: 1,
    periodUnit: 'month',
    reminderUnit: 'day',
    reminderValue: 7,
    notes: '家庭套餐',
    isActive: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z'
  },
  // ... 更多訂閱
]
```

---

## 🌐 部署配置

### wrangler.toml 配置
```toml
[env.production]
name = "subscription-manager"

[env.staging]
name = "subscription-manager-staging"

[kv_namespaces]
binding = "SUBSCRIPTIONS_KV"
id = "3f68b48591e14565bf1ad681271576cc"

[triggers]
crons = ["0 8 * * *"]  # UTC 時間，每日 08:00
```

### Cron 時區注意事項
- **Cron 執行時間**: 固定為 UTC 時區
- **時區轉換**: 由 config.TIMEZONE 控制實際執行邏輯
- **時間窗口**: config.NOTIFICATION_HOURS 限制發送時間

---

## 📋 開發環境設置

### 本地開發
```bash
bun install
bun run dev         # 啟動 Vite + Wrangler local mode
bun run typecheck   # 類型檢查
bun run lint        # 代碼檢查
bun run test        # 執行測試
bun run build       # 生成生產版本
```

### 部署
```bash
bun run deploy      # 部署到生產環境
```

### 類型生成
```bash
bun run cf-typegen  # 生成 Cloudflare 綁定類型
```

---

## ⚠️ 已知問題與風險

### 1. **KV 並發寫入競態條件** ⚠️
**問題**: `processSubscriptionReminder()` 中使用 `Promise.allSettled()` 並行更新 KV
```typescript
// 風險代碼示例
Promise.allSettled([
  kv.put('subscriptions', JSON.stringify(updated1)),
  kv.put('subscriptions', JSON.stringify(updated2))  // 後一個覆蓋前一個!
])
```

**改善方案**:
1. 收集所有更新，單次 put
2. 或使用 `getAndPut()` 序列化
3. 或分別存儲各訂閱 (key: `sub:uuid`)

### 2. **測試覆蓋不足**
- 缺少 `processSubscriptionReminder()` 的單元測試
- 無法測試邊界情況 (跨月、跨年)

### 3. **日誌/監控**
- 每個渠道應記錄獨立的成功/失敗日誌
- 便於排查通知失敗原因

---

## 🚀 優化亮點

### 1. 響應式設計
- 桌面: 標準表格佈局
- 移動: 卡片式佈局 (thead 隱藏)

### 2. 表單驗證
- 日期範圍檢查
- 周期值驗證
- 提醒值校驗

### 3. 多渠道通知
- 並行發送 (不互相影響)
- 詳細失敗日誌
- 模板引擎支持

### 4. 時區靈活配置
- 支持 IANA 時區字符串
- 動態控制通知時間窗口

### 5. 模組化架構
- 清晰的分層: routes → services → data
- 易於擴展新通知渠道
- 組件化 UI

---

## 📊 項目統計

- **主入口**: [`src/index.tsx`](src/index.tsx) (Worker)
- **路由文件**: 4 個 (auth, subscriptions, config, notify)
- **服務模組**: 3 個 (config, subscription, subscription_cron)
- **通知渠道**: 4 個 (Telegram, Bark, Resend, Webhook)
- **頁面組件**: 3 個 (Login, Admin, Config)
- **API 端點**: 9 個
- **KV 命名空間**: 1 個 (SUBSCRIPTIONS_KV)

---

## 🔮 未來優化方向

1. **並發安全**: 解決 KV 寫入競態條件
2. **單元測試**: 補全 `subscription_cron.ts` 和 service 層測試
3. **增強日誌**: 每次通知記錄詳細結果
4. **通知歷史**: 記錄每次通知發送情況
5. **數據導入/導出**: CSV/JSON 支持
6. **分類統計**: 訂閱分類統計圖表
7. **多用戶**: 當前僅支持單用戶管理

---

**文檔更新時間**: 2025-12-24
**專案版本**: 2.0.0+
**技術棧版本**: TypeScript + Hono + Vite + Cloudflare Workers
**維護者**: AI Coding Agent
