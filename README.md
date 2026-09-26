# SubsTracker - 訂閱管理與提醒系統

<div align="center">

一個基於 **Cloudflare Workers** 的現代化訂閱管理系統，幫助你追蹤所有訂閱服務的續約時間，並透過多渠道及時提醒。

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Hono](https://img.shields.io/badge/Hono-4.x-E36002?logo=hono&logoColor=white)](https://hono.dev/)

</div>

---

## ✨ 功能特色

### 🎯 核心功能

- **📋 訂閱管理**：完整的 CRUD 操作，管理所有訂閱服務
  - 支援自訂訂閱名稱、費用、續訂週期（日/月/年）
  - 靈活的提醒設定（提前 N 天/小時通知）
  - 分類標籤管理，快速篩選訂閱項目
  - 訂閱狀態切換（啟用/停用）

- **⏰ 智慧提醒**：自動化的到期提醒系統
  - 每日定時檢查（UTC 0:00 / 台北時間 08:00）
  - 可設定每日通知時段（如：9:00-22:00）
  - 提醒頻率控制（單次提醒或每日重複）
  - 支援測試通知功能

- **🔄 自動續期**：智慧的訂閱續期處理
  - 到期後自動計算下一個續訂日期
  - 支援日/月/年三種續訂週期
  - 保留提醒設定，無需重新配置

- **🔐 安全認證**：完善的權限控制
  - JWT Token 認證機制
  - 管理員密碼保護
  - CSRF 防護
  - API Token 驗證（第三方觸發）

- **🎨 現代化介面**：美觀且易用的管理介面
  - 響應式設計，支援行動裝置
  - 深色/淺色主題切換
  - 即時搜尋與篩選
  - Toast 通知與確認對話框

### 📱 多渠道通知

支援 **4 種通知渠道**，可同時啟用多個渠道進行通知：

| 渠道         | 圖示 | 說明                     | 配置項目                   |
| ------------ | ---- | ------------------------ | -------------------------- |
| **Telegram** | 🤖   | Telegram Bot 推送訊息    | Bot Token + Chat ID        |
| **Email**    | 📧   | 透過 Resend API 發送郵件 | Resend API Key + 收件地址  |
| **Webhook**  | 🔗   | 自訂 HTTP Webhook        | URL + 請求模板（支援變數） |
| **Bark**     | 🍎   | iOS Bark 應用推送        | Bark URL                   |

**通知訊息支援變數替換**：

- `{{name}}` - 訂閱名稱
- `{{date}}` - 到期日期
- `{{daysLeft}}` - 剩餘天數

---

## 🚀 一鍵部署

### 部署至 Cloudflare Workers

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/your-username/subs-tracker)

**部署步驟**：

1. **Clone 專案**

   ```bash
   git clone https://github.com/your-username/subs-tracker.git
   cd subs-tracker
   ```

2. **安裝依賴**（使用 Bun）

   ```bash
   bun install
   ```

3. **建立 KV 命名空間**

   ```bash
   # 建立生產環境 KV
   npx wrangler kv namespace create SUBSCRIPTIONS_KV

   # 建立預覽環境 KV
   npx wrangler kv namespace create SUBSCRIPTIONS_KV --preview
   ```

4. **更新 `wrangler.toml`**

   將步驟 3 產生的 KV namespace ID 填入 `wrangler.toml`：

   ```toml
   [[kv_namespaces]]
   binding = "SUBSCRIPTIONS_KV"
   id = "your-namespace-id-here"
   preview_id = "your-preview-namespace-id-here"
   ```

5. **部署到 Cloudflare**

   ```bash
   bun run deploy
   ```

6. **設定管理員密碼**（首次訪問時自動生成）

   訪問 `https://your-worker.workers.dev`，系統會自動生成 JWT Secret 和管理員密碼。

   查看 Cloudflare Dashboard 中的 KV 儲存空間，找到 `config` 鍵值中的 `ADMIN_PASSWORD`。

---

## 🤖 GitHub Actions 自動化部署

本專案已配置 GitHub Actions，可實現自動化的 CI/CD 部署流程。

### 工作流程

當你推送程式碼到 GitHub 時，GitHub Actions 會自動：

1. ✅ **程式碼檢查**：執行 ESLint 程式碼檢查
2. ✅ **型別檢查**：執行 TypeScript 型別驗證
3. ✅ **建置專案**：編譯 TypeScript 和打包資源
4. 🚀 **自動部署**：部署到對應的 Cloudflare Workers 環境

### 觸發條件

- **Push to `main`**：自動部署到 **生產環境**（`subscription-manager.workers.dev`）
- **Push to `staging`**：自動部署到 **測試環境**（`subscription-manager-staging.workers.dev`）
- **Pull Request**：執行 Lint 和 Type Check（不部署）
- **手動觸發**：在 GitHub Actions 頁面手動執行工作流程

### 設定步驟

#### 1. 取得 Cloudflare API Token

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 點選右上角頭像 → **My Profile** → **API Tokens**
3. 點選 **Create Token** → 使用 **Edit Cloudflare Workers** 範本
4. 設定權限：
   - **Account** → **Cloudflare Workers** → **Edit**
   - **Zone** → **Workers Routes** → **Edit**（如有自訂域名）
5. 複製生成的 API Token

#### 2. 取得 Cloudflare Account ID

1. 在 Cloudflare Dashboard 中選擇任一網站
2. 右側欄位中找到 **Account ID**
3. 點選複製圖示

#### 3. 設定 GitHub Secrets

在你的 GitHub 倉庫中設定以下 Secrets：

1. 進入 GitHub 倉庫 → **Settings** → **Secrets and variables** → **Actions**
2. 點選 **New repository secret**，新增以下兩個 Secrets：

| Secret Name             | 說明                  | 範例                       |
| ----------------------- | --------------------- | -------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API Token  | `xxxxxxxxxxxxxxxxxxxxxxxx` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | `a1b2c3d4e5f6g7h8i9j0`     |

#### 4. 推送程式碼觸發部署

設定完成後，只需推送程式碼即可觸發自動部署：

```bash
# 部署到生產環境
git checkout main
git add .
git commit -m "feat: add new feature"
git push origin main

# 部署到測試環境
git checkout staging
git merge main
git push origin staging
```

### 查看部署狀態

1. 進入 GitHub 倉庫的 **Actions** 頁面
2. 查看最近的 Workflow 執行記錄
3. 點選進入可查看詳細的執行日誌

### Workflow 檔案

完整的 GitHub Actions 配置位於：`.github/workflows/deploy.yml`

---

## 🔧 通知渠道配置

進入管理後台 → **系統設定** → **通知設定** 標籤頁，配置各通知渠道。

### 1. Telegram Bot

**申請 Telegram Bot**：

1. 在 Telegram 搜尋 `@BotFather`
2. 傳送 `/newbot` 指令建立新 Bot
3. 取得 **Bot Token**（格式：`123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`）

**取得 Chat ID**：

1. 在 Telegram 搜尋你的 Bot 並傳送任意訊息
2. 訪問 `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. 在回應中找到 `"chat":{"id":123456789}` 中的數字

**配置項目**：

- **Bot Token**：你的 Bot Token
- **Chat ID**：你的 Chat ID（數字）

---

### 2. Email (Resend)

**申請 Resend API Key**：

1. 註冊 [Resend](https://resend.com/) 帳號
2. 進入 Dashboard → **API Keys** → **Create API Key**
3. 複製生成的 API Key（格式：`re_xxxxxxxxxx`）

**驗證發信域名**（可選）：

- 若使用自訂域名，需在 Resend 中新增並驗證域名
- 可使用 Resend 提供的預設測試域名（有發信限制）

**配置項目**：

- **Resend API Key**：你的 API Key
- **發件地址**：如 `noreply@yourdomain.com`
- **收件地址**：接收通知的郵箱

---

### 3. Webhook

自訂 HTTP Webhook，支援 POST 請求與模板變數。

**配置項目**：

- **Webhook URL**：接收通知的 HTTP 端點
- **請求模板**（JSON 格式）：
  ```json
  {
    "title": "訂閱到期提醒",
    "content": "您的訂閱 {{name}} 將於 {{date}} 到期（剩餘 {{daysLeft}} 天）"
  }
  ```

**範例應用**：

- 整合至企業內部系統
- 觸發 IFTTT / Zapier 工作流程
- 自訂通知處理邏輯

---

### 4. Bark (iOS)

適用於 iOS 裝置的推送通知應用。

**安裝 Bark App**：

1. 從 App Store 下載 [Bark](https://apps.apple.com/app/bark-customed-notifications/id1403753865)
2. 開啟 App 取得你的 **Bark URL**（格式：`https://api.day.app/YOUR_KEY/`）

**配置項目**：

- **Bark URL**：你的 Bark 推送 URL

---

## 📦 技術棧

<table>
  <tr>
    <td><b>運行環境</b></td>
    <td>Cloudflare Workers（無伺服器，全球邊緣運算）</td>
  </tr>
  <tr>
    <td><b>後端框架</b></td>
    <td>Hono 4.x（輕量級 Web 框架）</td>
  </tr>
  <tr>
    <td><b>程式語言</b></td>
    <td>TypeScript 5.x（嚴格型別檢查）</td>
  </tr>
  <tr>
    <td><b>渲染引擎</b></td>
    <td>Hono JSX（伺服器端 JSX 渲染）</td>
  </tr>
  <tr>
    <td><b>資料儲存</b></td>
    <td>Cloudflare KV（鍵值對存儲）</td>
  </tr>
  <tr>
    <td><b>樣式框架</b></td>
    <td>Tailwind CSS 4.x + DaisyUI 5.x</td>
  </tr>
  <tr>
    <td><b>前端交互</b></td>
    <td>htmx + Vanilla TypeScript</td>
  </tr>
  <tr>
    <td><b>建置工具</b></td>
    <td>Vite 6.x + Wrangler 4.x</td>
  </tr>
  <tr>
    <td><b>套件管理</b></td>
    <td>Bun 1.x</td>
  </tr>
  <tr>
    <td><b>API 文件</b></td>
    <td>OpenAPI 3.x (Swagger UI)</td>
  </tr>
</table>

---

## 🛠️ 本地開發

### 環境需求

- **Bun**: >= 1.0.0
- **Cloudflare 帳號**：用於部署

### 開發指令

```bash
# 安裝依賴
bun install

# 啟動開發伺服器（http://localhost:5173）
bun run dev

# TypeScript 型別檢查
bun run typecheck

# ESLint 程式碼檢查
bun run lint

# 自動修復 Lint 錯誤
bun run lint:fix

# 建置生產版本
bun run build

# 預覽生產建置
bun run preview

# 部署至 Cloudflare Workers
bun run deploy

# 生成 Cloudflare 型別定義
bun run cf-typegen
```

---

## 📂 專案結構

```
subs-tracker/
├── src/
│   ├── index.tsx                # 應用入口 (fetch + scheduled handlers)
│   ├── openapi.ts               # OpenAPI 設定
│   ├── renderer.tsx             # JSX 渲染工具
│   ├── types/                   # TypeScript 型別定義
│   │   ├── index.ts             # 核心型別 (Bindings, Subscription, Config)
│   │   ├── api.d.ts             # API 回應型別
│   │   └── htmx.d.ts            # htmx 型別擴展
│   ├── middleware/
│   │   └── auth.ts              # JWT 認證中介層
│   ├── routes/                  # Hono 路由處理器
│   │   ├── auth.ts              # 登入/登出端點
│   │   ├── subscriptions.ts     # 訂閱 CRUD API
│   │   ├── config.ts            # 系統設定 API
│   │   └── notify.ts            # 第三方通知觸發
│   ├── services/                # 業務邏輯層
│   │   ├── subscription.ts      # 訂閱 CRUD + 自動續期
│   │   ├── subscription_cron.ts # Cron 任務邏輯
│   │   ├── config.ts            # 設定管理
│   │   └── notifier/            # 通知系統
│   │       ├── index.ts         # 多渠道通知調度器
│   │       ├── types.ts         # 通知型別定義
│   │       └── channels/        # 通知渠道實作
│   │           ├── bark.ts
│   │           ├── telegram.ts
│   │           ├── resend.ts
│   │           └── webhook.ts
│   ├── components/              # 可重用 JSX 元件
│   │   ├── Layout.tsx           # 基礎 HTML 佈局
│   │   ├── Navbar.tsx           # 導航列
│   │   └── admin/               # 管理頁面元件
│   ├── pages/                   # 完整頁面元件
│   │   ├── Login.tsx            # 登入頁
│   │   ├── Admin.tsx            # 訂閱管理頁
│   │   └── Config.tsx           # 系統設定頁
│   ├── client/                  # 客戶端 TypeScript 模組
│   │   ├── login/
│   │   ├── admin/
│   │   └── config/
│   └── utils/                   # 工具函式
│       ├── crypto.ts            # JWT & 密碼雜湊
│       ├── time.ts              # 日期時間工具
│       ├── logger.ts            # 日誌工具
│       └── response.ts          # 標準化 API 回應
├── wrangler.toml                # Cloudflare Workers 設定
├── package.json                 # 專案依賴
├── tsconfig.json                # TypeScript 設定
└── README.md                    # 專案說明文件
```

---

## 🔐 環境變數

系統首次啟動時會自動生成以下設定，儲存於 KV 的 `config` 鍵值中：

| 變數名稱                 | 說明                 | 預設值                                     |
| ------------------------ | -------------------- | ------------------------------------------ |
| `JWT_SECRET`             | JWT Token 加密密鑰   | 自動生成（32 字元）                        |
| `ADMIN_PASSWORD`         | 管理員密碼（已雜湊） | 自動生成（16 字元）                        |
| `TIMEZONE`               | 時區設定             | `Asia/Taipei`                              |
| `NOTIFICATION_HOURS`     | 通知時段             | `9,10,11,12,13,14,15,16,17,18,19,20,21,22` |
| `NOTIFICATION_FREQUENCY` | 提醒頻率             | `ONCE`（單次提醒）                         |

**修改設定**：進入管理後台 → 系統設定頁面

---

## 📅 Cron 任務排程

系統每日 **UTC 0:00**（台北時間 08:00）自動執行訂閱檢查：

1. 載入系統設定
2. 驗證當前時間是否在通知時段內
3. 取得所有啟用的訂閱
4. 並行處理提醒邏輯：
   - 檢查是否需要發送提醒
   - 發送多渠道通知
   - 處理自動續期
5. 原子批量更新（單次 KV 寫入，避免競態條件）
6. 記錄執行統計（已處理/已發送/已續期/已跳過/失敗）

**自訂 Cron 時間**：修改 `wrangler.toml` 中的 `crons` 設定

```toml
[triggers]
crons = ["0 0 * * *"]  # 每天 UTC 0:00 (台北時間 08:00)
```

---

## 🌐 API 文件

系統內建 **OpenAPI 規範**與 **Swagger UI**。

**訪問 API 文件**：

```
https://your-worker.workers.dev/api/ui
```

**API 回應格式**：

所有 API 遵循統一的回應格式：

✅ **成功回應**：

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

❌ **錯誤回應**：

```json
{
  "success": false,
  "message": "錯誤訊息",
  "code": "ERROR_CODE",
  "errors": [ ... ]
}
```

**HTTP 狀態碼**：

- `200` - 成功
- `201` - 已建立
- `400` - 請求錯誤
- `401` - 未授權
- `404` - 資源不存在
- `500` - 伺服器錯誤

---

## 🤝 貢獻指南

歡迎貢獻程式碼、回報問題或提出新功能建議！

1. Fork 此專案
2. 建立你的特性分支（`git checkout -b feature/amazing-feature`）
3. 提交你的修改（`git commit -m 'Add some amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 開啟 Pull Request

**程式碼規範**：

- 使用 TypeScript 嚴格模式
- 遵循 ESLint 設定（`@antfu/eslint-config`）
- 禁止使用 `any` 型別
- 優先使用函式元件與箭頭函式

---

## 📝 授權條款

MIT License

---

## 🙏 致謝

本專案使用了以下優秀的開源專案：

- [Hono](https://hono.dev/) - 輕量級 Web 框架
- [Cloudflare Workers](https://workers.cloudflare.com/) - 邊緣運算平台
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [DaisyUI](https://daisyui.com/) - Tailwind CSS 元件庫
- [htmx](https://htmx.org/) - 高互動性前端框架
- [Resend](https://resend.com/) - 現代化郵件服務
- [Lucide](https://lucide.dev/) - 圖示庫

---

<div align="center">

**讓 SubsTracker 幫助你管理所有訂閱，永不錯過續約時間！** ⏰✨

</div>
