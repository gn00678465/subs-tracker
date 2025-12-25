# 通知系統設定與自動發送指南

## 📱 通知渠道設定

### 1. Telegram 通知設定

**步驟 1: 創建 Telegram Bot**
1. 在 Telegram 中搜尋 `@BotFather`
2. 發送 `/newbot` 命令
3. 按提示設定 Bot 名稱
4. 記錄 BotFather 提供的 **Bot Token**（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

**步驟 2: 取得 Chat ID**
1. 啟動您剛創建的 Bot（點擊 BotFather 提供的連結）
2. 發送任意訊息給 Bot（例如：`/start`）
3. 在 Telegram 中搜尋 `@userinfobot`
4. 發送任意訊息，Bot 會回覆您的 **Chat ID**（純數字）

**步驟 3: 在系統中配置**
1. 登入 SubsTracker 後台
2. 進入「設定」頁面
3. 找到 **Telegram** 區塊
4. 填入：
   - **Bot Token**: 步驟 1 取得的 Token
   - **Chat ID**: 步驟 2 取得的 Chat ID
5. 點擊「儲存設定」

**實現檔案**: `src/services/notifier/channels/telegram.ts`

**配置驗證**: 需要 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID`

---

### 2. Bark 通知設定（iOS 推送）

**前置需求**: 在 iPhone 上安裝 [Bark App](https://apps.apple.com/app/bark-customed-notifications/id1403753865)

**配置步驟**:
1. 開啟 Bark App，複製顯示的 **伺服器 URL**（例如：`https://api.day.app`）
2. 複製您的 **Device Key**（App 中顯示）
3. 在 SubsTracker 設定頁面填入：
   - **Bark Server**: 伺服器 URL
   - **Bark Key**: Device Key
   - **儲存通知** (可選): 勾選後通知會保存在 Bark 歷史記錄中

**實現檔案**: `src/services/notifier/channels/bark.ts`

**配置驗證**: 需要 `BARK_SERVER` 和 `BARK_KEY`

**API 端點**: `{BARK_SERVER}/push`

---

### 3. Email 通知設定（Resend）

**步驟 1: 註冊 Resend**
1. 前往 [resend.com](https://resend.com) 註冊帳號
2. 驗證您的網域（或使用 Resend 提供的測試網域）
3. 在 Dashboard 中創建 **API Key**

**步驟 2: 配置**
在 SubsTracker 設定頁面填入：
- **Resend API Key**: 從 Dashboard 取得的 API Key
- **寄件人郵箱**: 已驗證的發信郵箱（例如：`noreply@yourdomain.com`）
- **寄件人名稱** (可選): 顯示的寄件者名稱
- **收件人郵箱**: 您要接收通知的郵箱

**實現檔案**: `src/services/notifier/channels/resend.ts`

**配置驗證**: 需要 `RESEND_API_KEY`、`EMAIL_FROM`、`EMAIL_TO`

**API 端點**: `https://api.resend.com/emails`

**郵件格式**: HTML 格式，自動將換行轉換為 `<br>` 標籤

---

### 4. Webhook 通知設定（自訂整合）

**使用場景**: 整合其他通知服務（Discord、Slack、自建系統等）

**配置選項**:
- **Webhook URL**: 目標 API 端點（必填）
- **HTTP 方法**: GET/POST/PUT/PATCH（預設 POST）
- **自訂 Headers** (可選): JSON 格式，例如：
  ```json
  {
    "Authorization": "Bearer your-token",
    "X-Custom-Header": "value"
  }
  ```
- **請求模板** (可選): 自訂 JSON 格式，支援變數：
  - `{{title}}`: 通知標題
  - `{{content}}`: 通知內容
  - `{{timestamp}}`: 時間戳記

**預設模板**:
```json
{
  "title": "{{title}}",
  "content": "{{content}}",
  "timestamp": "{{timestamp}}"
}
```

**Discord Webhook 範例**:
```
URL: https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_TOKEN
Method: POST
Template: {"content": "**{{title}}**\n\n{{content}}"}
```

**實現檔案**: 
- `src/services/notifier/channels/webhook.ts`
- `src/services/notifier/utils/template.ts` (模板引擎)

**配置驗證**: 需要 `WEBHOOK_URL`

**安全性**: 模板引擎會自動轉義 JSON 特殊字元，防止注入攻擊

---

## ⚙️ 啟用通知渠道

**配置位置**: 設定頁面的「啟用的通知渠道」區塊

**操作步驟**:
1. 勾選您想啟用的渠道（Telegram、Bark、Email、Webhook）
2. 可同時啟用多個渠道（系統會並行發送）
3. 設定「允許通知時段」: 限制通知發送的小時範圍
   - 格式: 逗號分隔的小時數（例如：`8,9,10,11,12,13,14,15,16,17,18,19,20,21,22`）
   - 或使用範圍表示（需自行展開）

**儲存位置**: Cloudflare KV (`SUBSCRIPTIONS_KV`)，key 為 `config`

**相關檔案**: 
- `src/services/config.ts` - 配置管理服務
- `src/pages/Config.tsx` - 配置 UI 頁面

---

## 🔔 自動通知功能

### 架構概覽

**核心服務**: `src/services/notifier/index.ts`

**主要函數**:
1. `sendNotificationToAllChannels()`: 發送通知到所有啟用的渠道
2. `sendSubscriptionReminder()`: 發送訂閱到期提醒（包裝函數）

**通知流程**:
```
1. 檢查通知時段 (isNotificationAllowedAtHour)
   ↓
2. 取得啟用的渠道列表 (config.ENABLED_NOTIFIERS)
   ↓
3. 並行發送到所有渠道 (Promise.allSettled)
   ↓
4. 聚合結果並返回統計資訊
```

### 當前狀態（2024-12-21）

**✅ 已完成（Phase 6）**:
- 通知服務核心 (`src/services/notifier/`)
- 四個通知渠道完整實現
  - Telegram (`channels/telegram.ts`)
  - Bark (`channels/bark.ts`)
  - Resend Email (`channels/resend.ts`)
  - Webhook (`channels/webhook.ts`)
- 時段過濾機制
- 模板引擎 (`utils/template.ts`)
- 類型定義 (`types.ts`)
- 訂閱提醒函數 `sendSubscriptionReminder()`
- 測試通知端點 (`POST /api/subscriptions/:id/test`)
- 第三方通知 API (`POST /api/notify/:token`)

**⏳ 待實現（Phase 7）**:
- `src/index.tsx` 中的 `scheduled` 處理器（目前標記為 TODO）
- 自動檢查訂閱到期邏輯
- 定期執行訂閱掃描

### Cron 觸發器配置

**配置檔案**: `wrangler.toml`

```toml
[triggers]
crons = ["0 8 * * *"]  # 每天早上 8:00 UTC 執行
```

**執行時機**: Cloudflare Workers 會在指定時間呼叫 `scheduled` 函數

### Phase 7 實現計畫

**目標**: 實現自動訂閱到期檢查與通知發送

**實現位置**: `src/index.tsx` 的 `scheduled` 函數

**預期邏輯**:
```typescript
export default {
  async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
    try {
      // 1. 取得系統配置
      const config = await getConfig(env)
      
      // 2. 取得所有訂閱
      const subscriptions = await getAllSubscriptions(env)
      
      // 3. 過濾出需要檢查的訂閱
      const activeSubscriptions = subscriptions.filter(s => 
        s.isActive &&           // 啟用狀態
        s.isReminderSet &&      // 已設定提醒
        s.expiryDate            // 有到期日
      )
      
      // 4. 檢查每個訂閱的到期日
      for (const sub of activeSubscriptions) {
        const expiryDate = parseDate(sub.expiryDate)
        const today = new Date()
        const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24))
        
        // 取得提醒天數（reminderMe 或從 reminderValue/reminderUnit 計算）
        const reminderDays = sub.reminderMe || 
          calculateReminderDays(sub.reminderValue, sub.reminderUnit) || 
          7 // 預設提前 7 天
        
        // 5. 如果剩餘天數符合提醒條件，發送通知
        if (daysLeft > 0 && daysLeft <= reminderDays) {
          logger.info(`發送訂閱到期提醒: ${sub.name} (剩餘 ${daysLeft} 天)`)
          
          await sendSubscriptionReminder(
            sub.name,
            sub.expiryDate,
            daysLeft,
            config
          )
        }
        
        // 6. 如果已過期且需要處理
        if (daysLeft < 0 && sub.autoRenew) {
          // 自動續期邏輯（根據 periodValue 和 periodUnit 計算新的到期日）
          logger.info(`訂閱已過期，執行自動續期: ${sub.name}`)
          // TODO: 實現自動續期邏輯
        }
      }
      
      logger.info('定期訂閱檢查完成')
    } catch (error) {
      logger.error('定期訂閱檢查失敗', error)
    }
  }
}
```

**通知觸發條件**:
- 訂閱狀態為「啟用」(`isActive: true`)
- 已設定提醒 (`isReminderSet: true`)
- 有到期日 (`expiryDate` 存在)
- 剩餘天數 ≤ 提醒天數 (`daysLeft <= reminderMe`)

**需要的工具函數**:
- `calculateReminderDays(value, unit)`: 將 reminderValue/reminderUnit 轉換為天數
- `parseDate(dateString)`: 解析日期字串為 Date 物件
- 現有的 `sendSubscriptionReminder()` 函數（已實現）

---

## 🧪 手動測試通知

### 方法 1: 測試單個訂閱的通知

**API 端點**: `POST /api/subscriptions/:id/test`

**實現檔案**: `src/routes/subscriptions.ts` (lines 245-302)

**需要認證**: 是（需要 JWT token）

**使用方式**:
1. 在訂閱管理頁面找到訂閱的「測試通知」按鈕
2. 或使用 API 直接呼叫：

```bash
curl -X POST https://your-domain.workers.dev/api/subscriptions/{id}/test \
  -H "Cookie: auth_token=YOUR_JWT_TOKEN"
```

**測試通知內容**:
```
標題: 測試通知: {訂閱名稱}
內容: 這是一條測試通知

訂閱名稱: {訂閱名稱}
到期日期: {到期日期}

如果您收到此通知，說明通知渠道配置正確。
```

**成功回應範例**:
```json
{
  "success": true,
  "data": {
    "totalChannels": 3,
    "successCount": 2,
    "failureCount": 1,
    "details": [
      {
        "channel": "telegram",
        "success": true,
        "message": "發送成功"
      },
      {
        "channel": "email",
        "success": true,
        "message": "發送成功",
        "details": { "id": "email_id_123" }
      },
      {
        "channel": "bark",
        "success": false,
        "error": "配置缺失: BARK_KEY"
      }
    ]
  },
  "message": "測試通知發送完成 (成功 2/3)"
}
```

**錯誤回應範例**:
```json
{
  "success": false,
  "message": "沒有啟用任何通知渠道，請先在配置頁面啟用並配置通知渠道"
}
```

---

### 方法 2: 第三方 API 觸發

**API 端點**: `POST /api/notify/:token`

**實現檔案**: `src/routes/notify.ts`

**OpenAPI 文檔**: 可在 `/ui` (Swagger UI) 查看

**需要認證**: 是（需要 API Token）

**Token 配置**:
1. 在設定頁面的「第三方 API Token」欄位設定 Token
2. 儲存後即可使用
3. 如未配置 Token，API 會回應 403 錯誤

**Token 傳遞方式（三選一）**:

1. **URL 路徑參數**:
```bash
curl -X POST https://your-domain.workers.dev/api/notify/YOUR_TOKEN \
  -H "Content-Type: application/json" \
  -d '{
    "title": "測試通知",
    "content": "這是一條測試訊息",
    "tags": ["測試", "重要"]
  }'
```

2. **Authorization Header**:
```bash
curl -X POST https://your-domain.workers.dev/api/notify/any \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "測試", "content": "內容"}'
```

3. **Query 參數**:
```bash
curl -X POST "https://your-domain.workers.dev/api/notify/any?token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "測試", "content": "內容"}'
```

**優先級**: 路徑參數 > Header > Query 參數

**請求 Schema**:
```typescript
{
  title?: string        // 預設: "第三方通知"
  content: string       // 必填
  tags?: string | string[]  // 可選，支援陣列或逗號分隔字串
}
```

**成功回應 (200)**:
```json
{
  "success": true,
  "data": {
    "msgid": "MSGID1703123456789",
    "totalChannels": 2,
    "successCount": 2
  },
  "message": "發送成功 (2/2)"
}
```

**錯誤回應範例**:

- **401 Unauthorized** (Token 無效):
```json
{
  "success": false,
  "message": "訪問未授權，令牌無效或缺失",
  "code": "UNAUTHORIZED"
}
```

- **403 Forbidden** (API 未啟用):
```json
{
  "success": false,
  "message": "第三方 API 已禁用，請在後台配置訪問令牌後使用",
  "code": "FORBIDDEN"
}
```

- **400 Bad Request** (無啟用渠道):
```json
{
  "success": false,
  "message": "沒有啟用任何通知渠道，請在配置頁面啟用並配置",
  "code": "NO_CHANNELS"
}
```

---

## 📊 通知發送機制特點

### 容錯設計

**並行發送**: 
- 使用 `Promise.allSettled` 同時發送到所有渠道
- 一個渠道失敗不影響其他渠道
- 實現位置: `src/services/notifier/index.ts` lines 68-93

**部分成功策略**:
- 只要有一個渠道成功即視為整體成功（HTTP 200）
- 所有渠道失敗才返回 500 錯誤
- 無啟用渠道返回 400 錯誤

**詳細報告**:
每個渠道的結果都會記錄：
```typescript
interface ChannelResult {
  channel: string       // 渠道名稱
  success: boolean      // 是否成功
  message?: string      // 成功訊息
  error?: string        // 錯誤訊息
  details?: any         // 額外資訊（API 回應等）
}
```

### 時段控制

**配置**: `config.NOTIFICATION_HOURS` (陣列格式，例如: `[8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]`)

**檢查邏輯**: `src/services/notifier/index.ts` lines 34-48
```typescript
const currentHour = new Date().getHours()
const isAllowed = isNotificationAllowedAtHour(config, currentHour)

if (!isAllowed) {
  logger.notification(`當前時段（${currentHour}時）不在允許的通知時段內，跳過發送`)
  return { totalChannels: 0, successCount: 0, failureCount: 0, results: [] }
}
```

**適用範圍**:
- ✅ 自動訂閱提醒（scheduled 任務）
- ✅ 測試通知（`POST /api/subscriptions/:id/test`）
- ✅ 第三方 API 觸發（`POST /api/notify/:token`）

**時區**: 使用伺服器時區（Cloudflare Workers 預設 UTC）

### 錯誤處理

**渠道級別錯誤**:
每個渠道獨立處理，常見錯誤類型：

1. **配置缺失**: 
   - 未填寫必要欄位（API Key、Token 等）
   - 返回: `{ success: false, error: "配置缺失: FIELD_NAME" }`

2. **API 錯誤**: 
   - 外部服務回應錯誤（無效憑證、網路問題、限流等）
   - 返回: `{ success: false, error: "HTTP 4xx/5xx" }`

3. **模板錯誤** (僅 Webhook):
   - 模板格式不正確或變數替換失敗
   - 返回: `{ success: false, error: "模板渲染失敗: ..." }`

**錯誤日誌**:
- 所有錯誤都會透過 `src/utils/logger.ts` 記錄
- 可在 Cloudflare Workers 日誌中查看

**重試機制**: 
- 目前未實現自動重試
- 建議在應用層實現（例如：監控失敗通知並手動重試）

---

## 🔍 除錯與故障排除

### 檢查配置

**驗證函數**:
- `validateTelegramConfig()` - `src/services/notifier/channels/telegram.ts`
- `validateBarkConfig()` - `src/services/notifier/channels/bark.ts`
- `validateResendConfig()` - `src/services/notifier/channels/resend.ts`
- `validateWebhookConfig()` - `src/services/notifier/channels/webhook.ts`

**手動檢查**:
```typescript
import { validateTelegramConfig } from '@/services/notifier/channels/telegram'
const config = await getConfig(env)
const validation = validateTelegramConfig(config)
console.log(validation) // { isValid: boolean, missingFields?: string[] }
```

### 常見問題

**1. Telegram 通知無法發送**
- 檢查 Bot Token 是否正確（格式：數字:字母數字）
- 確認已向 Bot 發送過訊息（Bot 無法主動聯繫未互動過的用戶）
- 驗證 Chat ID 是否正確（純數字或以 `-` 開頭的群組 ID）

**2. Email 通知失敗**
- 確認 Resend API Key 有效
- 檢查發信郵箱是否已在 Resend 驗證
- 查看 Resend Dashboard 的發送記錄

**3. Webhook 通知格式錯誤**
- 使用 JSON 驗證器檢查模板語法
- 確認變數名稱正確（`{{title}}`, `{{content}}`, `{{timestamp}}`）
- 測試目標 API 是否接受該格式

**4. 所有渠道都顯示「配置缺失」**
- 檢查是否已在設定頁面儲存配置
- 確認 `ENABLED_NOTIFIERS` 陣列包含正確的渠道名稱
- 清除瀏覽器快取後重新登入

---

## ✅ 設定檢查清單

### Telegram
- [ ] 已從 `@BotFather` 取得 Bot Token
- [ ] 已從 `@userinfobot` 取得 Chat ID
- [ ] 在設定頁面填入 `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID`
- [ ] 勾選「啟用的通知渠道」中的 **Telegram**
- [ ] 使用測試通知驗證配置
- [ ] 確認實際收到 Telegram 訊息

### Bark (iOS)
- [ ] iPhone 上已安裝 Bark App
- [ ] 複製 Bark Server URL（例如：`https://api.day.app`）
- [ ] 複製 Device Key
- [ ] 在設定頁面填入 `BARK_SERVER` 和 `BARK_KEY`
- [ ] 勾選啟用 **Bark**
- [ ] 測試並確認收到推送通知

### Email (Resend)
- [ ] 已註冊 Resend 帳號
- [ ] 已驗證發信網域（或使用測試網域）
- [ ] 已創建 API Key
- [ ] 填入 `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TO`
- [ ] (可選) 填入 `EMAIL_FROM_NAME`
- [ ] 勾選啟用 **Email**
- [ ] 測試並確認收到郵件

### Webhook (自訂整合)
- [ ] 確認目標 API 端點 URL
- [ ] (可選) 準備認證 Headers
- [ ] (可選) 自訂請求模板
- [ ] 填入 `WEBHOOK_URL`
- [ ] 設定 `WEBHOOK_METHOD` (預設 POST)
- [ ] (可選) 填入 `WEBHOOK_HEADERS` 和 `WEBHOOK_TEMPLATE`
- [ ] 勾選啟用 **Webhook**
- [ ] 測試並檢查目標系統是否收到請求

### 通用設定
- [ ] 設定「允許通知時段」（`NOTIFICATION_HOURS`）
- [ ] (可選) 設定「第三方 API Token」以啟用 `/api/notify` 端點
- [ ] 儲存所有配置
- [ ] 使用「測試通知」功能驗證所有啟用的渠道
- [ ] 檢查測試回應中的 `successCount` 是否等於啟用渠道數量

---

## 📚 相關檔案索引

### 核心服務
- `src/services/notifier/index.ts` - 通知服務主入口
- `src/services/notifier/types.ts` - 類型定義
- `src/services/notifier/utils/template.ts` - Webhook 模板引擎

### 通知渠道實現
- `src/services/notifier/channels/telegram.ts` - Telegram Bot API
- `src/services/notifier/channels/bark.ts` - Bark 推送服務
- `src/services/notifier/channels/resend.ts` - Resend Email API
- `src/services/notifier/channels/webhook.ts` - 自訂 Webhook

### API 路由
- `src/routes/notify.ts` - 第三方通知 API（OpenAPIHono）
- `src/routes/subscriptions.ts` - 訂閱管理（包含測試通知端點）

### 配置與工具
- `src/services/config.ts` - 配置管理服務
- `src/pages/Config.tsx` - 配置 UI 頁面
- `src/utils/logger.ts` - 日誌工具

### 定期任務
- `src/index.tsx` - 應用入口（`scheduled` 函數）
- `wrangler.toml` - Cron 觸發器配置