# Setup 0 — 視覺審查 harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 建立一套可以服務「真實 Worker」（含 KV 綁定、SSR、auth cookie）的本機環境，並透過 Playwright 自動登入後截圖 `/`、`/admin`、`/admin/config` 三個頁面，產出可供 AI 與 frontend-design 做前後視覺對比的 baseline 截圖。此計畫對應設計文件 §5.4「視覺審查 harness」。

**Architecture:** `bun run build`（`@cloudflare/vite-plugin`）將 Worker 打包到 `dist/`，由 `wrangler dev` 在固定 port（`4173`）**以 HTTPS** 服務（`--local-protocol https`），並綁定 `wrangler.toml` 中已存在的 `SUBSCRIPTIONS_KV`（preview/local 命名空間）。**HTTPS 是必要的**：auth cookie 由 `src/utils/crypto.ts` 的 `setTokenCookie` 以 `secure: true` + `sameSite: 'Strict'` 設定，純 HTTP `http://localhost` 下瀏覽器不會儲存／回送該 cookie，導致 `/admin`、`/admin/config` 被重導回登入頁、截圖失敗；改走 HTTPS 後 `Secure` cookie 才能在同源頂層導覽中正常 round-trip（`SameSite=Strict` 對同源頂層導覽不受影響）。Playwright 以 `ignoreHTTPSErrors: true` 接受 `wrangler dev` 的自簽憑證。`wrangler dev` 與 `wrangler kv key put --local` 共用 `.wrangler/state`，因此用 `wrangler kv key put --local` 寫入的 `config`／`subscriptions` 種子資料，與被服務的 Worker 讀到的是同一份。Playwright 透過 `webServer` 啟動「build + serve」，在測試開始前先跑 seed，再以 request context 取得 auth cookie 後截圖。視覺驗證僅做截圖，不做功能性斷言。

**Tech Stack:** Cloudflare Workers + Hono + Vite + TypeScript；package manager **bun**；client renderer **hono/jsx/dom**；UI **DaisyUI**；新增 devDependency **`@playwright/test`**（+ `bunx playwright install chromium`）。

---

## File Structure

| 路徑 | 職責 |
|---|---|
| `e2e/seed.ts` | 以 `wrangler kv key put --local` 寫入 `config`（含已知 admin 帳密的明文密碼）與 `subscriptions`（範例訂閱陣列）到本機 KV；冪等可重複執行 |
| `e2e/visual.spec.ts` | Playwright 測試：以 request context `POST /api/login` 取得 cookie，套用到 browser context，截圖 `/`(login，無 cookie)、`/admin`、`/admin/config` 至 `e2e/__screenshots__/baseline/` |
| `e2e/__screenshots__/baseline/` | baseline 截圖輸出目錄（`login.png`、`admin.png`、`admin-config.png`），作為審查產出物**入庫**，供 PV/P7 前後視覺對比 |
| `playwright.config.ts` | Playwright 設定：`webServer` 跑 seed + build + HTTPS serve（port 4173）、`baseURL`、`ignoreHTTPSErrors`、chromium project、輸出目錄 |
| `package.json` | 新增 `test:visual` script 與 `@playwright/test` devDependency |
| `.gitignore` | 忽略 `.wrangler/` 與 `e2e/.playwright-output/`（baseline 截圖**不**忽略，入庫供審查） |

---

### Task 1: Spike — 確認 build + `wrangler dev` 服務指令與 KV seed 指令

**Files:** （無原始碼變更；本任務只驗證指令並把結論寫入後續任務）

本任務是 **spike**：目標是親手跑通並記錄「以 `wrangler dev` **透過 HTTPS** 服務 build 後 Worker」的確切指令、以及「用 `wrangler kv key put --local` 寫入種子」的確切指令，並驗證 **`POST /api/login` 的 `Secure` cookie 能 round-trip、`/admin` 回 200（而非被重導回 `/`）**。後續所有任務都依賴本任務的結論。HTTPS 是硬性需求（auth cookie 為 `Secure` + `SameSite=Strict`，純 HTTP 不會被瀏覽器儲存／回送）。若 `wrangler dev` HTTPS 服務 build 產物不可行，退回 `vite preview --port 4173 --https`（fallback）。

- [ ] **Step 1: 確認 build 產物位置。** 執行：
  ```bash
  bun run build
  ```
  預期：Vite 完成 build，輸出包含 client 資產與 Worker entry。記錄 Worker 產物目錄（`@cloudflare/vite-plugin` 預設輸出到 `dist/`，Worker 進入點通常位於 `dist/subs-tracker/` 或 `dist/`）。執行下一步確認實際路徑。

- [ ] **Step 2: 列出 build 產物確認 Worker 進入點。** 執行：
  ```bash
  find dist -maxdepth 3 -name '*.js' -o -name 'wrangler.json' -o -name '.assetsignore' 2>/dev/null | head -40
  ```
  預期：看到打包後的 Worker `.js` 與（由 vite-plugin 產生的）部署用 `wrangler.json`/manifest。記下該 manifest 的確切路徑（例如 `dist/subs-tracker/wrangler.json`），它就是 `wrangler dev` 要載入的設定。

- [ ] **Step 3: 嘗試以 `wrangler dev` 透過 HTTPS 服務 build 產物（首選方案）。** 在背景啟動，使用上一步找到的 manifest（以下以 `dist/subs-tracker` 為例，實測時換成 Step 2 的實際路徑），並加上 `--local-protocol https` 讓 wrangler 以自簽憑證提供 HTTPS：
  ```bash
  bunx wrangler dev --config dist/subs-tracker/wrangler.json --port 4173 --local --local-protocol https
  ```
  預期：終端顯示 `Ready on https://localhost:4173`（注意是 `https`）。若 `--config` 指向 build 後 manifest 不被接受，改試在專案根目錄直接 `bunx wrangler dev --port 4173 --local --local-protocol https`（讓 wrangler 走根 `wrangler.toml` 的 `main = "src/index.tsx"`，由 wrangler 內建 esbuild 打包）。記錄哪一個指令成功，且該指令**必須含 `--local-protocol https`**。

- [ ] **Step 4: 驗證 HTTPS 服務回應真實 Worker 內容，且 `Secure` auth cookie 能 round-trip。** 另開終端執行（`-k` 接受自簽憑證）：
  ```bash
  curl -sk -o /dev/null -w '%{http_code}\n' https://localhost:4173/
  ```
  預期：回傳 `200`（登入頁）。再執行 `curl -sk https://localhost:4173/ | grep -ci 'login\|登入\|password\|密碼'` 預期 `>= 1`，確認是 SSR 後的真實登入頁而非空殼。

  接著驗證**登入 cookie round-trip**（這是 HTTPS 的關鍵驗證）：先 `POST /api/login` 把 `Secure` cookie 存進 cookie jar，再帶著 jar 請求 `/admin`，確認回 `200` 而非被重導回 `/`：
  ```bash
  curl -sk -c /tmp/vh-cookies.txt -X POST https://localhost:4173/api/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"visual-harness-pw"}' \
    -o /dev/null -w 'login:%{http_code}\n'
  grep -qi 'token' /tmp/vh-cookies.txt && echo 'cookie:stored'
  curl -sk -b /tmp/vh-cookies.txt -o /dev/null -w 'admin:%{http_code}\n' https://localhost:4173/admin
  ```
  預期：`login:200`、印出 `cookie:stored`（cookie jar 含 auth token，證明 `Secure` cookie 在 HTTPS 下被接受）、`admin:200`（**非** 302/重導回 `/`）。此步驟需先以 Step 6 的 seed 指令寫入 `config`（明文帳密 `admin` / `visual-harness-pw`）。記錄通過的 HTTPS 服務指令為「VERIFIED SERVE COMMAND」。

- [ ] **Step 5: 若 Step 3/4 失敗則驗證 fallback `vite preview`（HTTPS）。** 執行（`vite preview` 需 HTTPS 才能讓 `Secure` cookie round-trip；以 `--https` 啟用自簽 TLS）：
  ```bash
  bun run build && bunx vite preview --port 4173 --https
  ```
  另開終端 `curl -sk -o /dev/null -w '%{http_code}\n' https://localhost:4173/` 預期 `200`。注意：`vite preview` 使用「不同的 miniflare store」，與 `wrangler kv key put --local` 的 `.wrangler/state` 不一致，故 fallback 路徑的 seed 必須改走 `vite preview` 自身的 KV 機制；除非 `wrangler dev` 完全不可行，否則優先採用 Step 4 的 wrangler HTTPS 指令。記錄最終採用方案。

- [ ] **Step 6: 驗證 `wrangler kv key put --local` seed 指令。** 停止上面的服務後執行（寫入後立即讀回）：
  ```bash
  bunx wrangler kv key put --local --binding SUBSCRIPTIONS_KV config '{"ADMIN_USERNAME":"admin","ADMIN_PASSWORD":"visual-harness-pw","TIMEZONE":"Asia/Taipei"}'
  bunx wrangler kv key get --local --binding SUBSCRIPTIONS_KV config
  ```
  預期：`put` 顯示成功訊息；`get` 印出剛寫入的 JSON。確認 `.wrangler/state` 目錄已生成（`ls .wrangler/state`）。記錄為「VERIFIED SEED COMMAND」。注意：`getConfig` 會在首次讀取時把明文 `ADMIN_PASSWORD` 自動 hash 化並寫回，因此用明文密碼 seed、登入時用同一明文即可成功。

- [ ] **Step 7: 把結論寫入 spike 筆記。** 將「VERIFIED SERVE COMMAND」「VERIFIED SEED COMMAND」「Worker manifest 路徑」「採用首選或 fallback」四項，記在 commit message body 與後續任務開頭，供 Task 2–6 直接套用。

- [ ] **Step 8: Commit spike 結論（僅文件/筆記，無原始碼）。** 若 spike 過程未產生需入庫的檔案，可用 `--allow-empty` 標記里程碑：
  ```bash
  git add -A && git commit --allow-empty -m "chore(e2e): spike wrangler dev serve + kv seed commands for visual harness"
  ```

---

### Task 2: 建立 `e2e/seed.ts` 種子腳本

**Files:** `e2e/seed.ts`

本任務把 Task 1 Step 6 驗證過的 `wrangler kv key put --local` 指令封裝成可被 Playwright `webServer` 重複呼叫的冪等腳本，寫入 `config`（含已知 admin 帳密）與 `subscriptions`（範例陣列）。帳密採明文 `ADMIN_PASSWORD`，依賴 `getConfig` 首次讀取自動 hash 的行為。

- [ ] **Step 1: 建立 `e2e/seed.ts`，定義已知帳密常數與 config 種子。** 寫入完整內容：
  ```ts
  import { spawnSync } from 'node:child_process'

  // 已知 admin 帳密：getConfig 首次讀取時會把明文 ADMIN_PASSWORD 自動 hash，
  // 因此 seed 明文、登入用同一明文即可成功。visual.spec.ts 必須使用同一組常數。
  export const ADMIN_USERNAME = 'admin'
  export const ADMIN_PASSWORD = 'visual-harness-pw'

  const config = {
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
    TIMEZONE: 'Asia/Taipei',
    NOTIFICATION_HOURS: [],
    ENABLED_NOTIFIERS: [],
    REMINDER_MODE: 'ONCE',
  }
  ```

- [ ] **Step 2: 在 `e2e/seed.ts` 加入範例訂閱陣列（符合 `Subscription` 型別）。** 接續寫入：
  ```ts
  const subscriptions = [
    {
      id: 'seed-netflix',
      name: 'Netflix',
      category: '影音串流',
      currency: 'TWD',
      price: '390',
      startDate: '2026-01-01',
      expiryDate: '2026-06-10',
      hasEndDate: false,
      autoRenew: true,
      isFreeTrial: false,
      periodValue: 1,
      periodUnit: 'month',
      periodMethod: 'credit',
      website: 'https://www.netflix.com',
      isReminderSet: true,
      reminderMe: 7,
      notes: '家庭方案',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'seed-spotify',
      name: 'Spotify',
      category: '影音串流',
      currency: 'TWD',
      price: '149',
      startDate: '2026-02-15',
      expiryDate: '2026-12-15',
      hasEndDate: false,
      autoRenew: true,
      isFreeTrial: false,
      periodValue: 1,
      periodUnit: 'month',
      periodMethod: 'apple',
      website: 'https://www.spotify.com',
      isReminderSet: true,
      reminderMe: 3,
      notes: '',
      isActive: true,
      createdAt: '2026-02-15T00:00:00.000Z',
      updatedAt: '2026-02-15T00:00:00.000Z',
    },
    {
      id: 'seed-icloud',
      name: 'iCloud+',
      category: '雲端儲存',
      currency: 'TWD',
      price: '90',
      startDate: '2025-12-01',
      expiryDate: '2026-06-01',
      hasEndDate: false,
      autoRenew: false,
      isFreeTrial: false,
      periodValue: 1,
      periodUnit: 'year',
      periodMethod: 'apple',
      website: 'https://www.icloud.com',
      isReminderSet: false,
      reminderMe: 14,
      notes: '已停用範例',
      isActive: false,
      createdAt: '2025-12-01T00:00:00.000Z',
      updatedAt: '2025-12-01T00:00:00.000Z',
    },
  ]
  ```

- [ ] **Step 3: 在 `e2e/seed.ts` 加入透過 `wrangler kv key put --local` 寫入的函式。** 接續寫入（指令以 Task 1 Step 6 VERIFIED SEED COMMAND 為準）：
  ```ts
  function kvPut(key: string, value: unknown): void {
    const result = spawnSync(
      'bunx',
      [
        'wrangler',
        'kv',
        'key',
        'put',
        '--local',
        '--binding',
        'SUBSCRIPTIONS_KV',
        key,
        JSON.stringify(value),
      ],
      { stdio: 'inherit' },
    )
    if (result.status !== 0) {
      throw new Error(`seed kv put failed for key "${key}" (exit ${result.status})`)
    }
  }

  export function seed(): void {
    kvPut('config', config)
    kvPut('subscriptions', subscriptions)
    console.warn('[seed] config + subscriptions written to local KV')
  }

  seed()
  ```

- [ ] **Step 4: 驗證 seed 腳本可獨立執行。** 執行：
  ```bash
  bun run e2e/seed.ts && bunx wrangler kv key get --local --binding SUBSCRIPTIONS_KV subscriptions
  ```
  預期：印出 `[seed] config + subscriptions written to local KV`，並讀回剛寫入的訂閱 JSON 陣列（含 `Netflix`/`Spotify`/`iCloud+`）。

- [ ] **Step 5: Commit。**
  ```bash
  git add e2e/seed.ts && git commit -m "feat(e2e): add KV seed script for visual harness"
  ```

---

### Task 3: 安裝 `@playwright/test` 與 chromium

**Files:** `package.json`

- [ ] **Step 1: 安裝 `@playwright/test` 為 devDependency。** 執行：
  ```bash
  bun add -d @playwright/test
  ```
  預期：`package.json` 的 `devDependencies` 新增 `@playwright/test`，`bun.lock` 更新。

- [ ] **Step 2: 安裝 chromium 瀏覽器。** 執行：
  ```bash
  bunx playwright install chromium
  ```
  預期：下載並安裝 chromium，結束時無錯誤。

- [ ] **Step 3: 確認安裝版本。** 執行：
  ```bash
  bunx playwright --version
  ```
  預期：印出 `Version X.Y.Z`（無錯誤）。

- [ ] **Step 4: Commit。**
  ```bash
  git add package.json bun.lock && git commit -m "chore(e2e): add @playwright/test devDependency"
  ```

---

### Task 4: 建立 `playwright.config.ts`

**Files:** `playwright.config.ts`

`webServer.command` 必須在啟動服務前先跑 build 與 seed。**serve 段落必須直接複製 Task 1 spike 記錄的 VERIFIED SERVE COMMAND**（它是服務指令的唯一真實來源），不得在此自行假設 manifest 路徑或埠號。VERIFIED SERVE COMMAND 已含 HTTPS（`--local-protocol https`）與實測過的 manifest 路徑；下方範例中的 `bunx wrangler dev ...` 一段僅為佔位示意，**實作時整段以 spike 結論逐字替換**。`baseURL` 必須為 `https://`，並設 `ignoreHTTPSErrors: true` 以接受自簽憑證。若 spike 採 fallback，serve 段落換成 spike 記錄的 `bunx vite preview --port 4173 --https`。

- [ ] **Step 1: 建立 `playwright.config.ts`，設定 testDir / baseURL / 輸出目錄。** 寫入完整內容（`webServer.command` 的 serve 段落**逐字使用 Task 1 的 VERIFIED SERVE COMMAND**，不得保留下方示意的硬編路徑）：
  ```ts
  import { defineConfig, devices } from '@playwright/test'

  const PORT = 4173
  const BASE_URL = `https://localhost:${PORT}`

  // serveCommand：直接貼上 Task 1 spike 記錄的 VERIFIED SERVE COMMAND（含 --local-protocol https
  // 與實測 manifest 路徑）。下行為佔位示意，實作時逐字替換為 spike 結論。
  const serveCommand
    = 'bunx wrangler dev --config dist/subs-tracker/wrangler.json --port 4173 --local --local-protocol https'

  export default defineConfig({
    testDir: './e2e',
    testMatch: '**/*.spec.ts',
    fullyParallel: false,
    workers: 1,
    reporter: 'list',
    outputDir: './e2e/.playwright-output',
    use: {
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
      screenshot: 'off',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
    webServer: {
      command: `bun run build && bun run e2e/seed.ts && ${serveCommand}`,
      url: BASE_URL,
      ignoreHTTPSErrors: true,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  })
  ```

- [ ] **Step 2: 驗證設定可被 Playwright 載入。** 執行：
  ```bash
  bunx playwright test --list
  ```
  預期：印出可被探索到的測試清單（此時 `visual.spec.ts` 尚未建立，可能顯示 0 個測試但不報設定錯誤）。若報 `webServer` 指令錯誤，回到 Task 1 的 VERIFIED SERVE COMMAND 逐字校正 `serveCommand`（不要自行猜測 manifest 路徑）。

- [ ] **Step 3: Commit。**
  ```bash
  git add playwright.config.ts && git commit -m "feat(e2e): add playwright config with build+seed+serve webServer"
  ```

---

### Task 5: 建立 `e2e/visual.spec.ts` 截圖測試

**Files:** `e2e/visual.spec.ts`

流程：先在 `/`（未登入）截 login 頁；再用 request context `POST /api/login`（JSON）取得 `set-cookie`，套到 browser context，截 `/admin` 與 `/admin/config`。`POST /api/login` 成功會 set 一個 `Secure` + `SameSite=Strict` 的 auth cookie；因服務走 **HTTPS**（見 Task 1/4），Playwright（`ignoreHTTPSErrors: true`）可正常接收並回送該 `Secure` cookie，`/admin`、`/admin/config` 同源頂層導覽不受 `SameSite=Strict` 影響，故能通過受 `pageAuthMiddleware` 保護的頁面。帳密重用 `seed.ts` 匯出的常數。截圖寫入 baseline 子目錄 `e2e/__screenshots__/baseline/`，檔名固定為 `login.png`、`admin.png`、`admin-config.png`，這些檔案會**入庫**作為審查產出物。

> Fallback（僅當 HTTPS 不可行時）：若無法以 HTTPS 服務，可改用 request context 取得的 token，以 `context.addCookies([{ ...cookie, secure: false }])` 注入到 browser context 繞過 `Secure` 限制；但首選一律是 HTTPS round-trip，不採此法。

- [ ] **Step 1: 建立 `e2e/visual.spec.ts`，匯入帳密常數並設定 baseline 截圖目錄。** 寫入：
  ```ts
  import { expect, test } from '@playwright/test'
  import { ADMIN_PASSWORD, ADMIN_USERNAME } from './seed'

  const SCREENSHOT_DIR = 'e2e/__screenshots__/baseline'
  ```

- [ ] **Step 2: 加入「未登入 login 頁」截圖測試。** 接續寫入：
  ```ts
  test('screenshot login page', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${SCREENSHOT_DIR}/login.png`, fullPage: true })
  })
  ```

- [ ] **Step 3: 加入「登入取得 cookie 後截圖 /admin 與 /admin/config」測試。** 接續寫入：
  ```ts
  test('screenshot authenticated pages', async ({ page, context, request }) => {
    const loginResponse = await request.post('/api/login', {
      data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    })
    expect(loginResponse.status()).toBe(200)

    const cookies = await request.storageState()
    await context.addCookies(cookies.cookies)

    const adminResponse = await page.goto('/admin')
    expect(adminResponse?.status()).toBe(200)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${SCREENSHOT_DIR}/admin.png`, fullPage: true })

    const configResponse = await page.goto('/admin/config')
    expect(configResponse?.status()).toBe(200)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${SCREENSHOT_DIR}/admin-config.png`, fullPage: true })
  })
  ```

- [ ] **Step 4: 忽略執行期暫存（**不**忽略 baseline 截圖）。** 在 `.gitignore` 末尾追加（若尚未存在）。注意：`e2e/__screenshots__/baseline/` 為審查產出物，**必須入庫**，故**不**加入 `.gitignore`：
  ```
  e2e/.playwright-output/
  .wrangler/
  ```

- [ ] **Step 5: 型別檢查。** 執行：
  ```bash
  bun run typecheck
  ```
  預期：無型別錯誤（`visual.spec.ts`、`seed.ts`、`playwright.config.ts` 皆通過；無 `any`）。

- [ ] **Step 6: Commit。**
  ```bash
  git add e2e/visual.spec.ts .gitignore && git commit -m "feat(e2e): add visual screenshot spec for login/admin/config"
  ```

---

### Task 6: 新增 `test:visual` script 並擷取 baseline 截圖

**Files:** `package.json`

- [ ] **Step 1: 在 `package.json` 的 `scripts` 加入 `test:visual`。** 在 `"release:dry"` 那一行後新增：
  ```json
    "test:visual": "playwright test"
  ```
  確保前一行結尾逗號正確（即 `"release:dry": "...",` 後接 `"test:visual": "playwright test"`）。

- [ ] **Step 2: 執行視覺 harness，產出 baseline 截圖。** 執行：
  ```bash
  bun run test:visual
  ```
  預期：Playwright 經由 `webServer` 自動 build + seed + 以 HTTPS 服務 Worker，兩個測試皆 `passed`，並在 `e2e/__screenshots__/baseline/` 產生 `login.png`、`admin.png`、`admin-config.png`。

- [ ] **Step 3: 確認 baseline 截圖存在且非空。** 執行：
  ```bash
  ls -la e2e/__screenshots__/baseline/
  ```
  預期：列出 `login.png`、`admin.png`、`admin-config.png`，三者檔案大小皆 `> 0`。這三張即為視覺提升前的 baseline，供 PV/P7 階段前後對比。

- [ ] **Step 4: Commit（baseline 截圖為審查產出物，連同 script 一併入庫）。**
  ```bash
  git add package.json e2e/__screenshots__/baseline/login.png e2e/__screenshots__/baseline/admin.png e2e/__screenshots__/baseline/admin-config.png && git commit -m "feat(e2e): add test:visual script and capture baseline screenshots"
  ```

---

## Self-Review

**Spec coverage（對照 §5.4 四點）：**
1. 服務真實 Worker — Task 1 spike 驗證 `bun run build` + `wrangler dev --port 4173 --local-protocol https`（HTTPS，fallback `vite preview --port 4173 --https`），Task 4 `webServer.command` 以 spike 的 VERIFIED SERVE COMMAND 為唯一來源落實，並設 `baseURL: https://...` + `ignoreHTTPSErrors: true`；綁定 `wrangler.toml` 既有 `SUBSCRIPTIONS_KV`。✅
2. 資料 seed — Task 2 `e2e/seed.ts` 用 `wrangler kv key put --local` 寫入 `config`（明文 admin 帳密，依賴 `getConfig` 自動 hash）+ `subscriptions` 範例陣列；與 `wrangler dev` 共用 `.wrangler/state`。✅
3. Playwright 截圖 — Task 5 `e2e/visual.spec.ts`：request context `POST /api/login` 取 `Secure` cookie（HTTPS round-trip）→ 截圖 `/`、`/admin`、`/admin/config` 至 `e2e/__screenshots__/baseline/`（`login.png`/`admin.png`/`admin-config.png`）。✅
4. baseline 擷取 — Task 6 `bun run test:visual` 產出三張 baseline，連同 script 一併**入庫**作為審查產出物。✅
新增 devDependency `@playwright/test`（+ `bunx playwright install chromium`）於 Task 3。✅

**Placeholder scan：** 無 TBD/TODO/「add error handling」/「similar to Task N」。所有 code 步驟皆為完整可貼上的內容；指令步驟皆含確切指令與預期輸出。Task 1 為真 spike，其產出（VERIFIED SERVE/SEED COMMAND）以「依此調整」明確指向後續任務，而非空泛佔位。

**Type consistency：** `seed.ts` 範例訂閱欄位（`periodUnit: 'day'|'month'|'year'`、`periodMethod: 'credit'|'apple'|...`、必填 `id/name/expiryDate/autoRenew/isActive/createdAt/updatedAt`）對齊 `src/types/index.ts` 的 `Subscription`；config 種子欄位對齊 `Config`。`visual.spec.ts` 重用 `seed.ts` 匯出的 `ADMIN_USERNAME`/`ADMIN_PASSWORD` 常數，避免帳密不一致。全程無 `any`，符合專案「一律不使用 any」。

**Risks 對照：** seed 與服務一致性透過共用 `.wrangler/state` 解決（fallback 路徑於 Task 1 Step 5 明確標註不一致與替代做法）；auth cookie 為 `Secure` + `SameSite=Strict`（見 `src/utils/crypto.ts setTokenCookie`），故服務一律走 HTTPS 讓 `Secure` cookie 能 round-trip，Task 1 Step 4 明確驗證 `POST /api/login` cookie 落地且 `/admin` 回 200（非重導），Playwright 以 `ignoreHTTPSErrors` 接受自簽憑證（注入 `secure:false` cookie 僅為最後手段 fallback）；baseline 截圖為審查產出物，寫入 `e2e/__screenshots__/baseline/` 並**入庫**（不加入 `.gitignore`），僅 `.wrangler/` 與 `e2e/.playwright-output/` 被忽略。
