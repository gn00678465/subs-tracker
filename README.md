# SubsTracker

SubsTracker 是一個執行在 Cloudflare Workers 上的訂閱管理工具。它記錄每個訂閱的下次扣款日，並在扣款前透過通知管道提醒你。資料存在 Cloudflare D1。

## 功能

### 訂閱

- 每筆訂閱記錄名稱、金額、貨幣、付款週期（每 N 天、週、月、年）與下次扣款日。
- 選填欄位：分類、付款方式、網站、開始日、備註、取消期限。
- 「自動續訂」開啟時，下次扣款日過了以後，排程把日期推進到下一個週期。
- 「自動續訂」關閉時，卡片顯示「已續訂」按鈕。按下後，下次扣款日推進一個週期。
- 「試用中」開啟時，提醒內容改為試用結束。試用的金額不計入花費摘要。
- 設了取消期限時，提醒依取消期限計算。
- 可以停用訂閱。停用的訂閱不送提醒。

### 首頁（`/admin`）

- 卡片依下次扣款日排序，分成「需要處理」「7 天內」「30 天內」「之後」「已停用」。
- 花費摘要依貨幣分開，顯示每月與每年的平均金額。
- 搜尋比對名稱、分類、付款方式與備註。
- 沒有啟用通知管道，或上次排程有管道發送失敗時，頁面頂部顯示警告。
- 新增與編輯使用同一個表單。網址 `#new` 開啟新增表單，`#edit-<id>` 開啟編輯表單。
- 桌機寬度（1024px 以上）多一個側欄：花費摘要、各分類的每月平均、提醒狀態。

### 提醒

- 每筆訂閱的提醒可以選「沿用預設」「不提醒」或提前的天數。
- 提醒頻率有兩種：「只提醒一次」，或每天提醒直到扣款日。
- 排程每小時執行一次。只有在你的時區中到了每日提醒時間，排程才送出提醒。

### 登入

- 使用者名稱與密碼登入。
- Passkey 登入：使用「使用 passkey 登入」按鈕，或使用瀏覽器的自動填入。
- 新增 passkey、刪除 passkey、修改帳號前，你必須在 10 分鐘內登入過。超過 10 分鐘時，頁面要求你再輸入一次密碼或完成一次 passkey 驗證。

### 設定（`/admin/config`）

設定頁分成以下幾段。每一段各自儲存。

- 提醒：每日提醒時間、時區、預設提前天數、提醒頻率。
- 通知管道：Telegram、Email、Bark、Webhook。每個管道都有「傳送測試」。
- 帳號與登入：使用者名稱、密碼、passkey、登出。
- 資料：「匯出 JSON」下載所有訂閱與設定。匯出檔不含密碼雜湊、JWT 金鑰、passkey 與通知管道的憑證。
- 外觀：主題可選「跟隨系統」「淺色」「深色」。主題只存在目前的瀏覽器。

### 離線

Service worker（`public/sw.js`）快取 `GET /api/subscriptions` 與 `GET /api/settings` 的回應。離線時，頁面顯示最後一次取得的資料，並停用新增、編輯、刪除與儲存。登出時，service worker 刪除這兩個快取。

## 部署

### 需求

- [Bun](https://bun.sh/)
- Node.js 22.18 以上（`bumpp` 的需求；Vite 8 與 Wrangler 4 的需求較低）
- Cloudflare 帳號

### 新安裝

1. 取得原始碼並安裝套件。

   ```bash
   git clone https://github.com/gn00678465/subs-tracker.git
   cd subs-tracker
   bun install
   ```

2. 建立 D1 資料庫。這個指令把 `database_id` 寫入 `wrangler.toml`。

   ```bash
   bunx wrangler d1 create subs-tracker --binding DB --update-config
   ```

3. 部署。`bun run deploy` 先建置，再把 D1 migration 套用到遠端資料庫，最後執行 `wrangler deploy`。

   ```bash
   bun run deploy
   ```

4. 開啟 Worker 的網址，用 `admin` / `password` 登入。
5. 到設定頁的「帳號與登入」修改密碼。新密碼至少 8 個字元。

全新安裝的預設值：時區 `UTC`、每日提醒時間 09:00、預設提前 3 天、只提醒一次。到設定頁的「提醒」修改。

`wrangler.toml` 只定義一個 Worker，沒有 `[env.*]` 區段。

### 從 KV 版本升級

舊版把資料存在 KV（`SUBSCRIPTIONS_KV`）。新版只從 KV 讀取一次，把資料匯入 D1。

1. 保留 `wrangler.toml` 的 `[[kv_namespaces]]`。`id` 必須是舊版使用的 namespace。
2. 執行「新安裝」的步驟 2 與 3。
3. 開啟 app 一次，或等下一次排程。D1 的 `settings` 沒有資料時，Worker 在一個 `batch()` 內匯入 KV 的 `config`、`subscriptions` 與 passkey（`webauthn:*`）。

匯入不修改、不刪除 KV 的資料。匯入後，舊的帳號與密碼仍然可以使用。匯入的程式在 `src/services/legacyImport.ts`。

## 本機開發

```bash
# 安裝套件
bun install

# 在本機 D1 套用 migration
bun run db:migrate:local

# 啟動開發伺服器（Vite，預設 http://localhost:5173）
bun run dev
```

其他指令：

| 指令                 | 用途                                                            |
| -------------------- | --------------------------------------------------------------- |
| `bun run check`      | 格式檢查（oxfmt）、lint（oxlint）、型別檢查（tsc）與 `bun test` |
| `bun run fmt`        | 用 oxfmt 格式化                                                 |
| `bun run lint:fix`   | 用 oxlint 檢查，並修正可以自動修正的問題                        |
| `bun run build`      | 建置                                                            |
| `bun run preview`    | 建置後在本機執行打包後的 Worker                                 |
| `bun run cf-typegen` | 修改 `wrangler.toml` 後，重新產生 `worker-configuration.d.ts`   |

在本機觸發排程：開啟 `/cdn-cgi/handler/scheduled`。

在本機 D1 執行 SQL：

```bash
bunx wrangler d1 execute DB --local --command "SELECT * FROM subscriptions"
```

## 通知管道設定

到設定頁的「通知管道」，點開一個管道：

1. 打開「啟用」開關。
2. 填寫必要欄位。進階欄位在「進階」區塊內。
3. 按「傳送測試」。測試使用表單中目前的值，不必先儲存。
4. 按「儲存」。

必要欄位沒有值時，管道不能啟用。

### Telegram

必要欄位：Bot Token、Chat ID。

1. 在 Telegram 開啟 `@BotFather`，傳送 `/newbot`，取得 Bot Token。
2. 傳送任意訊息給你的 Bot。
3. 開啟 `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates`。回應中 `"chat":{"id":...}` 的數字是 Chat ID。

### Email（Resend）

必要欄位：Resend API Key、寄件地址、收件地址。進階欄位：寄件人名稱。

1. 註冊 [Resend](https://resend.com/)，在 Dashboard 建立 API Key。
2. 用自己的網域寄信時，先在 Resend 驗證這個網域。

### Bark（iOS）

必要欄位：裝置 Key。進階欄位：伺服器（預設 `https://api.day.app`）、保存到 Bark 歷史紀錄、查詢參數（例如 `sound=alarm&group=訂閱`）。

1. 從 App Store 安裝 [Bark](https://apps.apple.com/app/bark-customed-notifications/id1403753865)。
2. 開啟 Bark，複製推送網址 `https://api.day.app/<KEY>/` 中的 `<KEY>`。

### Webhook

必要欄位：網址。進階欄位：

- 方法：`POST`（預設）、`PUT` 或 `GET`。`GET` 不送出內容。
- 標頭（JSON），例如 `{"Authorization": "Bearer …"}`。
- 內容範本（JSON）。可用的變數是 `{{title}}`、`{{content}}`、`{{timestamp}}`。

沒有填寫內容範本時，Worker 送出：

```json
{ "title": "{{title}}", "content": "{{content}}", "timestamp": "{{timestamp}}" }
```

## 提醒排程

`wrangler.toml` 的 Cron 設定是 `0 * * * *`（每小時整點）。每次執行時，`runReminders()`（`src/services/subscription_cron.ts`）依序：

1. 讀取設定。如果你的時區目前的小時不等於每日提醒時間，就結束。
2. 在 `cron_runs` 新增一列。
3. 對每筆訂閱：
   - 自動續訂且下次扣款日已過時，推進下次扣款日。
   - 在提醒天數內且還沒提醒過時，發送到所有啟用的通知管道。
4. 用一個 `batch()` 寫入結果：各管道的發送紀錄（`reminder_deliveries`）、管道的最近結果（`notification_channels.last_status`）、訂閱的提醒時間。
5. 更新 `cron_runs` 的完成時間、已提醒與失敗的數量。

排程只用帶條件的 `UPDATE` 修改訂閱。排程執行時你修改了某筆訂閱，排程就不覆蓋你的修改。

在正式環境手動觸發：Cloudflare Dashboard → Workers → Triggers → Cron Triggers →「Trigger Now」。查看記錄：`bunx wrangler tail`。

## API

- Swagger UI：`/ui`
- OpenAPI JSON：`/doc`

| 路徑                        | 內容                                                     |
| --------------------------- | -------------------------------------------------------- |
| `/api/login`、`/api/logout` | 帳密登入與登出                                           |
| `/api/subscriptions`        | 訂閱的新增、讀取、修改、刪除；`/{id}/renew` 推進一個週期 |
| `/api/settings`             | 提醒、帳號、通知管道、測試通知、匯出                     |
| `/api/webauthn`             | Passkey 註冊、登入與管理                                 |

`/api/subscriptions`、`/api/settings` 與 passkey 的註冊和管理需要登入。登入後，JWT 存在 `token` cookie，有效期 7 天。API 也接受 `Authorization: Bearer <JWT>` 標頭。

成功的回應：

```json
{ "success": true, "data": {}, "message": "..." }
```

驗證失敗的回應（狀態碼 400）：

```json
{ "success": false, "message": "請求驗證失敗", "errors": [{ "path": "...", "message": "..." }] }
```

## 技術

| 項目       | 使用                                                             |
| ---------- | ---------------------------------------------------------------- |
| 執行環境   | Cloudflare Workers                                               |
| 儲存       | Cloudflare D1（KV 只用來匯入舊版資料）                           |
| 後端       | Hono 4、`@hono/zod-openapi`、Zod 4                               |
| 頁面       | Hono JSX 伺服器端渲染；瀏覽器端用 `hono/jsx/dom`                 |
| 樣式       | `src/style.css`，取自原型 `docs/design/subs-tracker-design.html` |
| 圖示       | Lucide                                                           |
| Passkey    | SimpleWebAuthn 13.2.2                                            |
| Email      | Resend                                                           |
| 建置       | Vite 8、`@cloudflare/vite-plugin`、Wrangler 4                    |
| 程式語言   | TypeScript 5.9（strict）                                         |
| 格式與檢查 | oxfmt、oxlint                                                    |
| 測試       | `bun test`                                                       |
| 套件管理   | Bun                                                              |

## 專案結構

```
subs-tracker/
├── migrations/              # D1 schema
├── public/                  # 靜態檔：service worker、manifest、圖示
├── docs/
│   ├── design/              # 原型與畫面規格
│   ├── research/            # 研究紀錄
│   └── dogfood.md           # 手動測試清單
├── src/
│   ├── index.tsx            # Worker 入口：fetch 與 Cron 的 scheduled
│   ├── openapi.ts           # OpenAPIHono、Swagger UI、驗證錯誤格式
│   ├── style.css            # 所有頁面的樣式
│   ├── routes/              # API 路由：auth、subscriptions、settings、webauthn
│   ├── services/            # 商業邏輯：訂閱、排程、設定、passkey、舊資料匯入
│   │   └── notifier/        # 通知管道：telegram、resend、bark、webhook
│   ├── db/                  # D1 的資料列轉換與查詢
│   ├── pages/               # 伺服器端渲染的頁面：Login、Home、Settings
│   ├── components/          # Layout、Icon
│   ├── client/              # 瀏覽器端程式：login、home、settings、shared
│   ├── middleware/          # JWT 驗證與重新驗證
│   ├── types/
│   ├── utils/               # 密碼雜湊與 JWT、日期、記錄、API 回應
│   └── test/                # 測試用的 D1 與驗證器
├── wrangler.toml
└── vite.config.ts
```

## 貢獻

- 開 PR 前，執行 `bun run check` 與 `bun run build`。
- 修改 UI、流程或套件後，照 `docs/dogfood.md` 操作一次 app。
- Commit 訊息使用 Angular 格式：`<type>(<scope>): <summary>`。
- 其他規則見 `AGENTS.md`。
