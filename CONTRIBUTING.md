# 開發

這份文件給修改程式的人。安裝與使用見 [README.md](README.md)；AI agent 的規則見 [AGENTS.md](AGENTS.md)。

## 開 PR 之前

- 開 PR 前，執行 `bun run check` 與 `bun run build`。
- 修改 UI、流程或套件後，照 `docs/dogfood.md` 操作一次 app。
- Commit 訊息使用 Angular 格式：`<type>(<scope>): <summary>`。
- 其他規則見 `AGENTS.md`。

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

| 項目       | 使用                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------- |
| 執行環境   | Cloudflare Workers                                                                          |
| 儲存       | Cloudflare D1（KV 只用來匯入舊版資料）                                                      |
| 後端       | Hono 4、`@hono/zod-openapi`、Zod 4                                                          |
| 頁面       | Hono JSX 伺服器端渲染；瀏覽器端用 `hono/jsx/dom`                                            |
| 樣式       | Tailwind CSS 4；元件樣式在 `src/style.css`，取自原型 `docs/design/subs-tracker-design.html` |
| 圖示       | Lucide                                                                                      |
| Passkey    | SimpleWebAuthn 14                                                                           |
| Email      | Resend                                                                                      |
| 建置       | Vite 8、`@cloudflare/vite-plugin`、Wrangler 4                                               |
| 程式語言   | TypeScript 5.9（strict）                                                                    |
| 格式與檢查 | oxfmt、oxlint                                                                               |
| 測試       | `bun test`                                                                                  |
| 套件管理   | Bun                                                                                         |

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

## 發布與部署

正式環境由 Cloudflare Workers Builds 部署：只有推送到 `release` 分支時才部署，推送 `main` 不會部署。設定與原因見 [`docs/research/2026-09-26-workers-builds-tag-deploy.md`](docs/research/2026-09-26-workers-builds-tag-deploy.md)。

發布步驟：

1. 切換到 `main`，並更新到與 `origin/main` 相同。工作目錄必須是乾淨的：bumpp 會把所有變更加進 release commit。

   ```bash
   git checkout main && git pull --ff-only
   ```

2. 依變更選一個指令。有破壞性變更用 `release:major`，有新功能用 `release:minor`，其他用 `release`。

   ```bash
   bun run release:minor
   ```

   bumpp 顯示新版本號並詢問是否繼續，按 Enter 確認。接著它更新 `package.json` 的版本號、產生 `CHANGELOG.md`、commit、建立 tag，推送 `main` 與 tag，最後把同一個 commit 推送到 `release`。

3. 到 GitHub 上這個 release commit 的檢查，確認「Workers Builds: subs-tracker」成功。建置失敗時，點進檢查看 Cloudflare 的建置紀錄。

回復到前一版：Cloudflare Dashboard → Workers & Pages → `subs-tracker` → Deployments，選前一個版本部署。
