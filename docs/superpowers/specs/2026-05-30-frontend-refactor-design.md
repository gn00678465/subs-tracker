# 前端重構設計 — Client 層統一、視覺提升與 AI 審查基礎設施

- **日期**：2026-05-30
- **狀態**：Design（待 review，v2）
- **範圍**：前端 client 層重構 + 視覺設計提升 + 後端 cron 兩項缺陷修正 + vitest 測試基礎設施 + AI 視覺審查基礎設施
- **技術前提**：維持 Cloudflare Workers + Hono.js；維持 `hono/jsx/dom` 渲染層；視覺提升於 **Tailwind v4 + DaisyUI** 之上進行，不新增前端渲染框架依賴

---

## 1. 背景與問題

前端 client 層經多次修改，累積了不一致的寫法，導致每次新增功能都要重抄一套樣板。實際盤點到的問題：

| # | 問題 | 位置 |
|---|---|---|
| 1 | 三種 DOM 渲染風格並存：`hono/jsx/dom` 的 `render()`、template-string + `innerHTML`、手寫 `getElementById` | `tableRenderer.tsx` vs `config/index.ts` |
| 2 | 大量 `as any` / `as unknown as`，違反「一律不使用 any」 | `config/index.ts`、`formAdaptor.ts`、`loadPasskeys` |
| 3 | 無統一 API 層：重複手寫 `fetch + response.ok + json() as + try/catch`，envelope 解析防禦式重複（`data.data && Array.isArray(...)`） | `admin/index.ts`、`config/index.ts`、`login/*` |
| 4 | 按鈕 loading 樣板重複 4+ 份（禁用/切 icon/切 loading/finally 還原） | `subscriptionModal.ts`、`config/index.ts`、`login/*` |
| 5 | 兩種事件綁定：JSX `onClick` vs `window.registerPasskey` 全域暴露 + inline `onclick=""` | `SubscriptionTableRow.tsx` vs `config/index.ts` |
| 6 | 初始化時機不一：`index.ts` 在 `DOMContentLoaded`，`subscriptionModal.ts` 在 module top-level | `admin/*` |
| 7 | 兩種 lucide 用法：tree-shaken `createIcons({icons})` vs 全域 `window.lucide.createIcons()` | `tableRenderer.tsx` vs `config/index.ts` |
| 8 | 狀態管理不對稱：admin 有 cache + CustomEvent 系統；config 靠 `setTimeout(loadConfig, 1000)` | `admin/index.ts` vs `config/index.ts` |

**架構本身（Hono SSR + Vite island scripts）合理**，問題集中在 client 層缺乏共用抽象，且視覺風格為通用 DaisyUI 預設、缺乏記憶點。

併入本次的其他項目：

- **後端 A — 時區不一致**：`src/index.tsx:98` 的 cron 用 `new Date().getUTCHours()`，`src/services/notifier/index.ts:35` 用 `new Date().getHours()`，且兩者都忽略 `config.TIMEZONE`。
- **後端 B — 假純函數真 mutation**：`src/services/subscription_cron.ts` 的 `processSubscriptionReminder` 註解標示「純函數」，卻直接 mutate 傳入的 `subscription` 物件。
- **測試缺口**：`AGENTS.md` 宣稱使用 Vitest，但專案實際**沒有任何測試基礎設施**。
- **視覺審查缺口**：`bun run dev` 為純 Vite dev server，無法穩定取得真實 Worker 內容（KV 綁定、SSR、auth），不利於介面的視覺審查。需以 build 後 wrangler/preview 服務 + 瀏覽器自動化截圖來支援 AI 視覺審查。

---

## 2. 目標與非目標

### 目標
1. 消除三種並存的渲染寫法，統一為 `hono/jsx/dom` 元件渲染。
2. 抽出 client 共用 lib 層（API / DOM / async-ui / icons / store），消除重複樣板。
3. 清除所有 `as any` / `as unknown as`。
4. 統一事件綁定與初始化時機，移除 `window.x` 全域暴露與 inline `onclick`。
5. Bootstrap vitest，對純 lib 層以 TDD（先測後寫）建立單元測試。
6. 修正後端 cron 的時區不一致與 mutation 缺陷（以單元測試鎖定行為）。
7. **視覺設計提升**（frontend-design 介入）：在 Tailwind v4 + DaisyUI 之上，建立有記憶點、一致的視覺風格（字體、配色主題、動效、版面），套用於 login / admin / config。
8. **建立 AI 視覺審查基礎設施**（Setup 0）：以 wrangler/preview 服務真實 Worker + Playwright 截圖，支援 AI 與 frontend-design 的前後視覺對比審查。

### 非目標（YAGNI）
- ❌ 不改 API envelope 格式或路由路徑。
- ❌ 不新增前端 UI/渲染框架依賴（續用 `hono/jsx/dom` + DaisyUI + lucide）。
- ❌ 不從零重建設計系統；視覺提升以 **客製 DaisyUI 主題 + Tailwind theme** 為界，不更換 CSS/元件框架。
- ❌ 不寫 DOM island 的功能性 E2E 斷言（Playwright 僅用於視覺截圖審查；功能驗證以單元測試為主）。
- ❌ 不處理 cron 缺陷以外的後端 services / routes / KV 邏輯。

### 成功標準
- `bun run lint && bun run typecheck && bun run test && bun run build` 全綠。
- client 層無 `any`；fetch / loading / 渲染 各只有一套標準做法。
- lib 層 + adaptor + cron 邏輯單元測試覆蓋 ≥ 80%。
- 視覺提升經 Playwright 前後截圖對比、由 frontend-design 與使用者審查核可；功能行為無非預期回歸。

---

## 3. 目標架構

維持既有分層（Hono SSR pages/components + Vite island scripts），新增 client 共用 lib 層、視覺主題、與 AI 審查 harness：

```
src/
├── client/
│   ├── lib/                  ← 新增：共用、純邏輯、可單元測試
│   │   ├── api.ts
│   │   ├── dom.ts
│   │   ├── async-ui.ts
│   │   ├── icons.ts
│   │   └── store.ts
│   ├── admin/                ← 改用 lib + store
│   ├── config/               ← 改用 lib，passkey 改元件渲染
│   └── login/                ← 改用 lib
├── components/
│   └── config/
│       ├── PasskeyList.tsx   ← 新增（取代 innerHTML 字串）
│       └── PasskeyItem.tsx   ← 新增
├── style.css                 ← 視覺提升：DaisyUI 主題 + Tailwind theme 變數
└── services/
    ├── subscription_cron.ts  ← 修正 mutation
    └── notifier/index.ts     ← 修正時區

e2e/                          ← 新增：AI 視覺審查 harness
├── playwright.config.ts
├── seed.ts                   ← 注入 admin config + 範例訂閱到 KV preview/local
└── visual.spec.ts            ← 登入後截圖 login / admin / config

vitest.config.ts              ← 新增
docs/superpowers/specs/2026-05-30-frontend-refactor-design.md
```

### 3.1 共用 lib 層介面（簽名為設計意圖，實作時可微調）

**`src/client/lib/api.ts`** — 統一 API 客戶端
```ts
export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export function createApi(fetchImpl: typeof fetch) {
  async function request<T>(path: string, opts?: RequestOptions): Promise<T> { /* envelope 解析 */ }
  return {
    get: <T>(path: string, opts?: RequestOptions) => request<T>(path, opts),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'POST', body }),
    put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'PUT', body }),
    delete: <T>(path: string, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'DELETE' }),
  }
}

export const api = createApi(globalThis.fetch.bind(globalThis))
```
- 統一解開 `{ success, data, message }` envelope；`success === false` 或 HTTP 非 2xx 丟 `ApiError(message, status)`，成功回傳 `data`。

**`src/client/lib/dom.ts`** — typed DOM 存取
```ts
export function el<T extends HTMLElement>(id: string): T | null
export function elx<T extends HTMLElement>(id: string): T          // 找不到即拋出
export function els<T extends HTMLElement>(selector: string): T[]
export function mount(target: HTMLElement | string, vnode: unknown): void  // 包裝 hono/jsx/dom render + 清空
```

**`src/client/lib/async-ui.ts`** — 統一 async UI 狀態
```ts
interface LoadingTargets {
  button?: HTMLButtonElement | null
  show?: (HTMLElement | null)[]
  hide?: (HTMLElement | null)[]
}
export async function withLoading<T>(targets: LoadingTargets, fn: () => Promise<T>): Promise<T>
```

**`src/client/lib/icons.ts`** — 單一 lucide 初始化
```ts
export function renderIcons(root?: ParentNode): void
```

**`src/client/lib/store.ts`** — 極小狀態容器
```ts
export interface Store<T> {
  get: () => T
  set: (next: T | ((prev: T) => T)) => void
  subscribe: (fn: (state: T) => void) => () => void
}
export function createStore<T>(initial: T): Store<T>
```

### 3.2 元件層
- 新增 `src/components/config/PasskeyList.tsx`（+ `PasskeyItem.tsx`），以 `/** @jsxImportSource hono/jsx/dom */` 渲染，取代 `loadPasskeys` 的 `innerHTML` 字串。
- config 的 `window.registerPasskey` + inline `onclick=""` → 改為元件 `onClick` 或 `addEventListener`。

---

## 4. 後端 cron 修正

### 4.1 時區不一致（後端 A）
抽出共用 helper，**兩處都改用它**，並讓通知時段尊重 `config.TIMEZONE`：
```ts
// 內部使用既有的 utils/time.ts: getDateParts(new Date(), config.TIMEZONE).hour
export function getCurrentHour(config: Config): number
```
- `src/index.tsx` scheduled：`getUTCHours()` → `getCurrentHour(config)`。
- `src/services/notifier/index.ts`：`getHours()` → `getCurrentHour(config)`。
- `isNotificationAllowedAtHour` 簽名不變。**決策**：尊重 `config.TIMEZONE`（已 review 採此方案）。

### 4.2 假純函數真 mutation（後端 B）
`processSubscriptionReminder` 改為不 mutate 輸入參數，以 spread 建立新物件回傳；以單元測試驗證輸入物件未被改動。

---

## 5. Setup 0 — AI 基礎設施、防護與視覺審查

**目的**：在動任何重構前，先建立供應鏈防護、AI agent 資產、harness 基礎設定，以及可審查真實 Worker UI 的視覺 harness。

**S0 工具鏈（依序執行，每步獨立 commit）：**

**5.1 供應鏈防護 — `/security-supply-chain`**
- 本專案為 bun-based，預期產出/調整：
  - `bunfig.toml`：`install.minimumReleaseAge`（≥7 天，擋住攻擊者發佈後的安裝窗口）、`install.ignoreScripts = true` + `trustedDependencies` allowlist（限制 lifecycle/postinstall 腳本）。
  - Pre-commit secret scan（gitleaks/trufflehog）：commit 時掃描，防止洩漏 token。
  - 驗證：`bun.lock` 已 commit、CI 使用 `bun install --frozen-lockfile`、`.npmrc` 不含 `_authToken`。
- 在新增 devDependencies（vitest / @playwright/test / happy-dom）**之前**先建立防護，再安裝。

**5.2 AI 基礎設定 — `/react-ai-infra`**
- **前置**：需先安裝 `apm`（Agent Package Manager）CLI 並在 PATH；否則此 skill 會中止並列出安裝指令。
- 框架選 **Vite + React（slug: `vite-react`）**。預期產出：
  - `apm.yml`（root，專案名 `subs-tracker`，`targets:` 含 `claude` + `agent-skills`，視情況加 `copilot`）。
  - `apm install` 副作用：建立 `apm_modules/` 並把 `apm_modules/` 追加進 `.gitignore`。
  - skills → `.claude/skills/<name>/` + `.agents/skills/<name>/`（跨 client bus）。
  - rules → `.claude/rules/<name>.md`，並轉換 frontmatter 寫入 `.github/instructions/<name>.instructions.md`。
  - `AGENTS.md`：`vite-react` **無對應模板 → Step 7 乾淨略過**（不會覆寫既有 `AGENTS.md`）。
- ⚠️ **合身性警示（必審）**：此 skill 內建資產為 **React 專屬**——`no-use-effect` skill 與 scope 為 `src/**/*.{tsx,jsx}` 的 `react-components` rule。本專案用 `hono/jsx`（**非 React**），這些資產**不適用**且可能誤導。Step 0 執行時應只保留「agent 資產接線」（`apm.yml`、`.agents/skills/` bus），**剔除或停用 React 專屬 skill/rule**，避免污染 client 層重構。

**5.3 harness 基礎設定 — `/harness-creator`**
- 建立/稽核/強化 AI coding agent 的輕量 harness。預期產出（皆為文件/設定層，不動 runtime 程式）：
  - **AGENTS.md / CLAUDE.md**：補上本次重構的 harness 區塊——scope boundary（前端 client 層 + cron 兩缺陷，明列不可動的範圍）、verification workflow（`lint + typecheck + test + build` + 視覺 harness 截圖）。
  - **feature state**：追蹤 S0→P7 各階段狀態的輕量檔（例如 `docs/` 下的進度/狀態記錄），供跨 session 接手。
  - **memory persistence / context control**：約定本次重構的記憶與交接慣例（與既有 session-summary 機制相容）。
  - **tool safety**：標註高風險操作邊界（KV 寫入、deploy、release）。
- **整合而不覆寫**：與既有 `AGENTS.md`/`CLAUDE.md` 的 OpenSpec、GitNexus 受管區塊共存；只新增 harness 區塊，不更動既有受管內容。

**5.4 視覺審查 harness（wrangler + Playwright）**
1. **服務真實 Worker**：`bun run build` → 以 **`wrangler dev`** 對 build 後的 Worker 在固定 port 服務（`bun run dev` 的純 Vite 取不到 Worker 內容，故改用 wrangler）；備援為 `vite preview --port 4173`。綁定 KV preview 命名空間（`wrangler.toml` 已有 `preview_id`）。
2. **資料 seed**：`e2e/seed.ts` 注入 admin config（含已知帳密）與範例訂閱到 local/preview KV，使受 auth 保護頁面可被審查。
3. **Playwright 截圖 harness**：`e2e/visual.spec.ts` 先 `POST /api/login` 取 cookie，再截圖 `/`(login)、`/admin`、`/admin/config` 至 `e2e/__screenshots__/`。
4. **前後對比**：視覺提升前擷取 baseline，提升後再擷取，供審查。

**新增 devDependencies**：`@playwright/test`（皆 devDep，不影響 Workers bundle）。

---

## 6. 視覺設計提升（frontend-design 介入）

**界線**：於 Tailwind v4 + DaisyUI 之上提升，不更換框架、不改 API/路由、不破壞既有元件語意；提升集中在 `src/style.css` 的 **DaisyUI 自訂主題 + Tailwind theme 變數**，以及元件層的版面/間距/狀態表現微調。

**流程**：
1. frontend-design 依產品脈絡（訂閱到期管理工具）提出 **2–3 個明確且互異的美學方向 mockup**（字體、配色、動效、版面），透過 Setup 0 的 harness 呈現截圖。**已確認**：使用者不預設美學偏好，由 frontend-design 主動提案、使用者再從中選定。
2. 使用者選定方向後，套用為 DaisyUI 主題 + Tailwind theme，逐頁調整。
3. 以 Setup 0 截圖做前後對比，frontend-design 與使用者審查核可。

**注意**：字體與配色避免通用 AI 風格（不用 Inter/Roboto/系統字、不用紫漸層白底）；以 CSS 變數維持一致；動效以 CSS-only 為主，聚焦頁面載入的高影響時刻。

---

## 7. 測試策略（TDD、單元為主）
- **工具**：`vitest` + `happy-dom` + `@vitest/coverage-v8`（devDep）。
- **設定**：`vitest.config.ts` 設 `environment: 'happy-dom'`，esbuild `jsxImportSource: 'hono/jsx/dom'`；`package.json` 補 `test` / `test:watch` / `test:coverage`。
- **單元測試對象**（純 / 可注入）：`api`（注入 mock fetch）、`store`、`dom`、`async-ui`、`formAdaptor`、`getCurrentHour`、`processSubscriptionReminder`（含驗證輸入未被 mutate）。
- **流程**：每檔 red → green → refactor。覆蓋 ≥ 80%。
- **視覺**：Playwright 僅做截圖審查，不寫功能性斷言。

---

## 8. 實作階段（每階段一個 commit，跑 `typecheck + build`）

| 階段 | 內容 |
|---|---|
| **S0** | **AI 基礎設施、防護與視覺審查**：`/security-supply-chain`（供應鏈防護）→ `/react-ai-infra`（AI 資產，框架選 Vite）→ `/harness-creator`（harness 設定）→ wrangler + Playwright 視覺 harness + seed + **baseline 截圖** |
| P0 | Bootstrap vitest（devDep、`vitest.config.ts`、test script、JSX runtime smoke test） |
| P1 | lib 層（TDD）：先測後寫 `api` / `dom` / `async-ui` / `store`；`icons` 輕量整合 |
| P2 | 後端 cron 修正（TDD）：`getCurrentHour(config)` + immutable `processSubscriptionReminder` |
| P3 | admin island：改用 store + lib，保留表格元件 |
| P4 | config island：`<PasskeyList>` 取代 innerHTML、移除 `window` 全域 / inline onclick、清 `as any` |
| P5 | login + webauthn island：套 api / async-ui，去重 loading 邏輯 |
| P6 | formAdaptor：`periodMethod` 正確型別取代 `as any` + 補單元測試 |
| **PV** | **視覺設計提升（frontend-design）**：提方向 mockup → 使用者選定 → 套用 DaisyUI 主題/Tailwind theme → 前後截圖對比審查 |
| P7 | 收尾：依 `.claude/rules/remove_code_slop.md` 清 slop、lint/typecheck/test/build 全綠、截圖最終確認 |

> 結構/邏輯重構（P1–P6）刻意維持視覺穩定，以便與 S0 baseline 對比、隔離回歸；視覺改動集中於 PV，獨立審查與回滾。

---

## 9. 風險與回滾

| 風險 | 緩解 |
|---|---|
| hono/jsx/dom 在 vitest 的 JSX runtime 設定 | P0 先以 smoke test 驗證 `jsxImportSource` |
| Playwright harness 需登入才能截圖受保護頁 | seed 已知 admin 帳密 → `POST /api/login` 取 cookie → 截圖 |
| `vite preview` / `wrangler dev` 的 KV 綁定與 seed 一致性 | 固定使用 preview/local 命名空間 + 冪等 seed 腳本 |
| 視覺提升造成非預期行為回歸 | 視覺與邏輯分階段（PV 獨立）、S0 前後截圖對比、純邏輯單元測試擋著 |
| 視覺方向主觀分歧 | PV 先提 2–3 方向 mockup 由使用者選定，再實作 |
| Workers bundle 變大 | 無新增 runtime 依賴；vitest/happy-dom/playwright 皆 devDep |
| 回滾 | 每階段獨立 commit，可逐階段 revert；PV 為獨立 commit 可單獨還原視覺 |
