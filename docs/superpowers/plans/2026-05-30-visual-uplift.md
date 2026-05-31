# 視覺設計提升 (PV) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 在不更換框架、不改 API/路由、不破壞既有元件語意的前提下，於 Tailwind v4 + DaisyUI 之上建立有記憶點且一致的視覺風格。流程為：由 `frontend-design` 主動提出 2–3 個互異的美學方向（使用者無預設偏好，從中選定一個），將選定方向落地為 `src/style.css` 的 DaisyUI 自訂主題 + Tailwind theme 變數，再做逐頁（login / admin / config）的間距與狀態微調，最後以 Plan 2 視覺 harness 做前後截圖對比並經使用者核可。

**Architecture:** 視覺改動集中於兩層——(1) `src/style.css` 內的 DaisyUI v5 `@plugin "daisyui/theme"` 主題定義 + Tailwind v4 `@theme` CSS 變數（字體、圓角、間距 token）；(2) `src/pages/*.tsx` 與 `src/components/**` 的 DaisyUI class 級別微調（間距、狀態、載入時刻動效）。不新增 runtime 依賴；不動 client island 行為邏輯（`src/client/**`）；不動 services / routes / KV。視覺與邏輯分離：本 plan 對應 spec §8 的 **PV** 階段，刻意在結構/邏輯重構（P1–P6）之後、收尾（P7）之前獨立執行，以便與 baseline 對比、隔離回歸、可單獨回滾。

**Tech Stack:** Tailwind CSS v4（`@tailwindcss/vite`）、DaisyUI v5（`daisyui` devDependency，`@plugin` 機制）、hono/jsx SSR + hono/jsx/dom client、Vite 6、Cloudflare Workers、Plan 2 視覺 harness（`wrangler dev` + Playwright，`bun run test:visual` 將 baseline 截圖輸出至 `e2e/__screenshots__/baseline/`，檔名為 `login.png` / `admin.png` / `admin-config.png`）。截圖為 review 產物並納入版控（Plan 2 已移除 `e2e/__screenshots__/` 的 `.gitignore` 條目），故 `git add e2e/__screenshots__/...` 可正常運作。

---

## File Structure

| 檔案 | 變更 | 用途 |
|------|------|------|
| `docs/superpowers/plans/2026-05-30-visual-uplift.md` | 新增（本檔） | PV 階段實作計畫 |
| `docs/superpowers/design/2026-05-30-visual-directions.md` | 新增 | 記錄 `frontend-design` 提出的 2–3 個方向、各自 token 草案、使用者選定結果（決策紀錄） |
| `e2e/__screenshots__/baseline/` | 讀取 | Plan 2 產出的 baseline 截圖（`login.png` / `admin.png` / `admin-config.png`），作為前後對比基準 |
| `e2e/__screenshots__/pv-after/` | 新增（產出，納入版控的 review 產物） | PV 套用後的截圖（`login.png` / `admin.png` / `admin-config.png`），與 baseline 對比；截圖未被 gitignore，commit 至版控 |
| `src/style.css` | 修改 | DaisyUI 自訂主題（light/dark）+ Tailwind `@theme` token；本 plan 視覺改動的主要落點 |
| `src/pages/Login.tsx` | 修改 | 登入頁間距/狀態/載入動效微調（維持既有 DaisyUI class 語意） |
| `src/pages/Admin.tsx` | 修改 | 管理頁版面/間距微調 |
| `src/pages/Config.tsx` | 修改 | 設定頁版面/間距微調 |
| `src/components/Navbar.tsx` | 修改（如需要） | 導覽列間距/狀態微調 |
| `src/components/ToggleTheme.tsx` | 修改（如需要） | 主題切換按鈕視覺微調 |
| `src/components/admin/**` | 修改（如需要） | 表格/卡片間距與狀態微調，不動渲染邏輯 |

---

## Task 1: 確認 baseline 截圖就緒

**Files:** `e2e/__screenshots__/baseline/`（讀取）、`e2e/visual.spec.ts`（讀取，Plan 2 產出）

> 本 plan 依賴 Plan 2 的視覺 harness 已建立、且 P1–P6 邏輯重構後的 baseline 截圖存在。先確認，不存在才補跑。視覺對比若無基準即無意義，故為第一道 gate。

- [ ] **Step 1：確認 harness 與 baseline 存在**
  Run: `ls e2e/__screenshots__/baseline/ && grep -n "test:visual" package.json`
  Expected：`e2e/__screenshots__/baseline/` 內含 `login.png`、`admin.png`、`admin-config.png`（config 頁路徑為 `/admin/config`，檔名為 `admin-config.png`）；`package.json` 有 `test:visual` script。若兩者皆在，跳至 Step 3。

- [ ] **Step 2：baseline 缺失時補跑 harness（僅在 Step 1 失敗時執行）**
  Run: `bun run build && bun run test:visual`
  說明：`test:visual` 依 Plan 2 定義，會以 `wrangler dev` 服務 build 後 Worker（備援 `vite preview --port 4173`）、執行 `e2e/seed.ts` 注入 admin config 與範例訂閱、`POST /api/login` 取 cookie，截圖 `/`(login)、`/admin`、`/admin/config`，並寫入 `e2e/__screenshots__/baseline/`（檔名 `login.png` / `admin.png` / `admin-config.png`）。
  Expected：`e2e/__screenshots__/baseline/` 產出 `login.png` / `admin.png` / `admin-config.png`，指令 exit code 0。
  > 若 Plan 2 尚未完成（無 `test:visual` script），STOP 並回報使用者：PV 依賴 Plan 2 視覺 harness，需先完成 Plan 2。

- [ ] **Step 3：記錄 baseline 清單**
  Run: `ls -1 e2e/__screenshots__/baseline/`
  將檔名清單貼入 `docs/superpowers/design/2026-05-30-visual-directions.md` 的「Baseline」段，供 Task 5 對比引用。

- [ ] **Step 4：Commit**
  Run: `git add docs/superpowers/design/2026-05-30-visual-directions.md && git commit -m "docs(ui): record visual baseline screenshot inventory for PV"`

---

## Task 2: frontend-design 提出方向並由使用者選定（決策檢查點）

**Files:** `docs/superpowers/design/2026-05-30-visual-directions.md`（產出決策紀錄）

> 這是**決策檢查點**，不是預寫 CSS。`frontend-design` 在此「產出」Task 3 所需的設計 token；Task 3 「消費」它們。輸出為 2–3 個明確互異的方向（字體、配色、動效、版面），透過 Plan 2 harness 呈現為 mockup 截圖，交由使用者選定。使用者**無預設美學偏好**，因此方向由 `frontend-design` 主動提案。本 task 完成前 Task 3 不得開始。

- [ ] **Step 1：以產品脈絡叫用 `frontend-design`**
  輸入給 skill 的脈絡：
  - 產品：訂閱到期管理工具（login / admin 列表 / config 設定三頁）。
  - 硬限制：續用 Tailwind v4 + DaisyUI + hono/jsx，不更換框架、不改 API/路由、不破壞既有 DaisyUI 元件語意；改動須能表達為 DaisyUI 主題 + Tailwind `@theme` token + class 級別微調。
  - 反通用要求（spec §6 注意事項）：字體避免 Inter/Roboto/系統字；配色避免「紫漸層白底」AI 風格；動效以 CSS-only 為主、聚焦頁面載入的高影響時刻。
  - 既有限制觀察：現行 `src/style.css` 僅覆寫 `--color-primary: #36A45D`，並有 root `view-transition` 設定；新方向需相容於既有 light/dark 雙主題與 view-transition。

- [ ] **Step 2：產出 2–3 個互異方向（mockup）**
  要求 `frontend-design` 對每個方向給出：方向名稱與設計理念、字體（標題/內文）、配色（primary/secondary/accent/base 與語意色 success/warning/error）、圓角與間距節奏、頁面載入動效描述。透過 Plan 2 harness 將各方向暫時套入 `src/style.css` 並 `bun run build && bun run test:visual` 截圖至 `e2e/__screenshots__/direction-<n>/`（為暫態探索，**截圖後 revert `src/style.css`**，不留在工作樹）。

- [ ] **Step 3：呈現給使用者並等待選定（GATE）**
  將 2–3 組方向截圖與 token 草案呈現給使用者。**STOP 並等待使用者明確選擇一個方向**，不得自行替使用者決定。

- [ ] **Step 4：記錄選定決策**
  將被選方向的完整 token（字體名、各色票 hex/oklch、圓角、間距 token、動效描述）寫入 `docs/superpowers/design/2026-05-30-visual-directions.md`，標題標明「選定方向」，並記錄落選方向供日後參考。此檔即為 Task 3 的權威輸入來源。

- [ ] **Step 5：Commit**
  Run: `git add docs/superpowers/design/2026-05-30-visual-directions.md && git commit -m "docs(ui): record proposed visual directions and user-selected theme tokens"`
  > 不 commit `direction-<n>/` 暫態截圖（探索用），且 `src/style.css` 在此 task 應已 revert 回 Task 1 後狀態。

---

## Task 3: 將選定方向落地為 DaisyUI 主題 + Tailwind theme token

**Files:** `src/style.css`

> 本 task 的 token 值**刻意延後**到 Task 2 才能取得——這是本 plan 唯一合法的延後輸入，已透過 Task 2 決策檢查點消除不確定性。以下提供**確定的機制與結構**（DaisyUI v5 `@plugin "daisyui/theme"` + Tailwind v4 `@theme`），明確標註「選定後填入」的 token 槽位；agent 必須從 `docs/superpowers/design/2026-05-30-visual-directions.md` 的「選定方向」段讀取實際值填入，**不得自行發明色票**。

- [ ] **Step 1：確認已有選定方向**
  Run: `grep -n "選定方向" docs/superpowers/design/2026-05-30-visual-directions.md`
  Expected：命中。若無命中，STOP，回到 Task 2。

- [ ] **Step 2：以選定 token 改寫 `src/style.css` 的主題定義**
  保留既有 `@import "tailwindcss";`、view-transition 區塊與 `:root { view-transition-name: root }` 不動。
  DaisyUI v5 主題用 `@plugin "daisyui/theme" { name: "..."; ... }` 定義；同時用 Tailwind v4 `@theme` 暴露字體/間距 token 供 utility class 使用。**機制如下，`<<選定後填入：...>>` 為 Task 2 產出的實際值**：

  ```css
  @import "tailwindcss";

  /* DaisyUI 啟用既有 light/dark 雙主題；保留 prefersdark 行為 */
  @plugin "daisyui" {
    themes: light --default, dark --prefersdark;
  }

  /* 淺色主題：以選定方向的色票替換 */
  @plugin "daisyui/theme" {
    name: "light";
    default: true;
    color-scheme: "light";
    --color-primary: <<選定後填入：primary hex/oklch>>;
    --color-secondary: <<選定後填入：secondary>>;
    --color-accent: <<選定後填入：accent>>;
    --color-base-100: <<選定後填入：base-100>>;
    --color-base-200: <<選定後填入：base-200>>;
    --color-base-300: <<選定後填入：base-300>>;
    --color-success: <<選定後填入：success>>;
    --color-warning: <<選定後填入：warning>>;
    --color-error: <<選定後填入：error>>;
    --radius-box: <<選定後填入：卡片圓角，如 0.75rem>>;
    --radius-field: <<選定後填入：輸入框/按鈕圓角>>;
  }

  /* 深色主題：同方向的深色變體色票 */
  @plugin "daisyui/theme" {
    name: "dark";
    color-scheme: "dark";
    --color-primary: <<選定後填入：dark primary>>;
    --color-secondary: <<選定後填入：dark secondary>>;
    --color-accent: <<選定後填入：dark accent>>;
    --color-base-100: <<選定後填入：dark base-100>>;
    --color-base-200: <<選定後填入：dark base-200>>;
    --color-base-300: <<選定後填入：dark base-300>>;
    --color-success: <<選定後填入：dark success>>;
    --color-warning: <<選定後填入：dark warning>>;
    --color-error: <<選定後填入：dark error>>;
    --radius-box: <<選定後填入：卡片圓角>>;
    --radius-field: <<選定後填入：輸入框/按鈕圓角>>;
  }

  /* Tailwind v4 theme token：字體與間距節奏，供 utility class 使用 */
  @theme {
    --font-sans: <<選定後填入：內文字體 stack，避免 Inter/Roboto/系統字>>;
    --font-display: <<選定後填入：標題字體 stack>>;
    --spacing: <<選定後填入：間距基準，如 0.25rem，若不調整則維持預設並移除此行>>;
  }

  /* 既有 View Transition 設定原封不動保留於此（見原檔） */
  ```

  > 字體若為自託管/外部字型，需確認載入方式與既有 `src/style.css` / `Layout.tsx` 的資源載入相容；若改用 `@font-face`，加在 `@theme` 之後、view-transition 之前。

- [ ] **Step 3：同步 Layout 的 `theme-color`（如選定方向改了 primary）**
  若選定 primary 不再是 `#36A45D`，更新 `src/components/Layout.tsx` 的 `<meta name="theme-color" content="...">` 為新 primary，使 PWA 狀態列一致。其餘 `Layout.tsx` 內容不動。

- [ ] **Step 4：型別/建置驗證**
  Run: `bun run typecheck && bun run build`
  Expected：皆通過。CSS 改動不應引入型別錯誤；build 應成功且 bundle 無新增 runtime 依賴。

- [ ] **Step 5：Commit**
  Run: `git add src/style.css src/components/Layout.tsx && git commit -m "feat(ui): apply selected DaisyUI theme and Tailwind theme tokens"`

---

## Task 4: 逐頁間距與狀態微調

**Files:** `src/pages/Login.tsx`、`src/pages/Admin.tsx`、`src/pages/Config.tsx`、`src/components/Navbar.tsx`、`src/components/ToggleTheme.tsx`、`src/components/admin/**`

> 在新主題上做 class 級別的版面/間距/狀態/載入動效微調，**維持既有 DaisyUI class 語意與元件結構**（不改 `id`、`name`、`data-lucide`、`role` 等被 client island 依賴的屬性，不動 `src/client/**` 行為）。改動依 Task 2 選定方向的版面節奏，逐頁進行。

- [ ] **Step 1：login 頁微調**
  在 `src/pages/Login.tsx` 套用選定方向的間距節奏與載入時刻動效（如 card 進場、按鈕 hover/active 狀態）。保留 `#loginForm`、`#submitBtn`、`#btnLoading`、`#errorMsg`、`#webauthnLoginBtn` 等 island 依賴的 `id` 與 `data-lucide` 屬性不變。

- [ ] **Step 2：admin 頁微調**
  在 `src/pages/Admin.tsx` 與必要的 `src/components/admin/**`、`src/components/Navbar.tsx` 調整列表/卡片間距與狀態色（呼應選定方向的語意色）。不改表格渲染所依賴的結構與屬性。

- [ ] **Step 3：config 頁微調**
  在 `src/pages/Config.tsx` 調整表單區塊間距與分組視覺層次。保留表單欄位 `id`/`name` 與 island 綁定點不變。

- [ ] **Step 4：主題切換一致性**
  在 `src/components/ToggleTheme.tsx` 確認新主題下 light/dark 切換的視覺一致（按鈕狀態、icon 對比度）。

- [ ] **Step 5：型別/建置驗證**
  Run: `bun run typecheck && bun run build`
  Expected：皆通過。

- [ ] **Step 6：Commit**
  Run: `git add src/pages src/components && git commit -m "feat(ui): polish per-page spacing, states and load-time motion"`

---

## Task 5: 前後截圖對比與使用者核可

**Files:** `e2e/__screenshots__/pv-after/`（產出）、`docs/superpowers/design/2026-05-30-visual-directions.md`（更新審查結論）

> 以 Plan 2 同一 harness 重新截圖，與 Task 1 baseline 對比，確認視覺提升落地且功能行為無非預期回歸（截圖層級的觀察；功能性回歸由 P1–P6 單元測試保障）。經使用者核可後才 commit 完成 PV。

- [ ] **Step 1：產出 PV 後截圖**
  Run: `bun run build && bun run test:visual`
  將輸出收整至 `e2e/__screenshots__/pv-after/`（`login.png` / `admin.png` / `admin-config.png`，config 頁對應 `/admin/config`）。
  Expected：三頁截圖（`login.png` / `admin.png` / `admin-config.png`）產出，指令 exit code 0。

- [ ] **Step 2：前後對比呈現**
  將 `baseline/` 與 `pv-after/` 對應頁面並列呈現給使用者與 `frontend-design`，逐頁說明套用了選定方向的哪些 token 與微調。

- [ ] **Step 3：使用者核可（GATE）**
  **STOP 並等待使用者核可**。若使用者要求調整，回到 Task 3（token）或 Task 4（class 微調）對應步驟，修正後重跑 Step 1–2，直到核可。

- [ ] **Step 4：記錄審查結論**
  在 `docs/superpowers/design/2026-05-30-visual-directions.md` 補上「前後對比審查結論」段（核可日期、對比要點、遺留事項）。

- [ ] **Step 5：全套件驗證**
  Run: `bun run lint && bun run typecheck && bun run test && bun run build`
  Expected：全綠。視覺改動不應破壞既有單元測試與建置。

- [ ] **Step 6：Commit**
  Run: `git add e2e/__screenshots__/pv-after docs/superpowers/design/2026-05-30-visual-directions.md && git commit -m "test(ui): add PV after screenshots and record approved visual review"`

---

## Self-Review

**Spec coverage（對 spec §6 視覺設計提升 + §8 PV 階段）：**
- §6「界線：Tailwind v4 + DaisyUI 之上、不更換框架、不改 API/路由、不破壞元件語意」→ Task 3（限定 `src/style.css` 主題 token）+ Task 4（class 級別、保留 island 依賴屬性）✓
- §6「流程 1：frontend-design 提 2–3 互異方向 mockup（字體/配色/動效/版面）、使用者無預設偏好由其選定」→ Task 2 決策檢查點 + GATE ✓
- §6「流程 2：選定後套用為 DaisyUI 主題 + Tailwind theme、逐頁調整」→ Task 3 + Task 4 ✓
- §6「流程 3：以 Setup 0/Plan 2 截圖做前後對比、frontend-design 與使用者審查核可」→ Task 5 + GATE ✓
- §6「注意：避免通用 AI 風格字體/配色、CSS 變數一致、CSS-only 動效聚焦載入時刻」→ Task 2 Step 1 反通用要求 + Task 4 載入動效 ✓
- §8 PV「提方向 → 選定 → 套用 → 前後對比審查」逐項對應 Task 2→3→4→5 ✓
- §8 註記「PV 為獨立 commit 可單獨還原視覺」→ 各 Task 獨立 commit、視覺改動集中於 `src/style.css` + pages/components ✓

**Placeholder scan（刻意的 token 依賴說明）：** 全文唯一的 placeholder 為 Task 3 CSS 範本中的 `<<選定後填入：...>>` token 槽位。此為 spec §6「使用者選定方向後才有 token」的本質性延後輸入，已透過 Task 2 決策檢查點（含 STOP GATE 與決策紀錄檔）將其轉為「Task 2 產出、Task 3 消費」的明確依賴，並明令 agent 從 `docs/superpowers/design/2026-05-30-visual-directions.md` 讀值、不得自行發明色票。其餘所有檔案路徑、指令（`bun run build`、`bun run test:visual`、`bun run lint && bun run typecheck && bun run test && bun run build`）、DaisyUI v5 `@plugin "daisyui/theme"` 與 Tailwind v4 `@theme` 機制、截圖路徑（`e2e/__screenshots__/baseline/`、`e2e/__screenshots__/direction-<n>/`、`e2e/__screenshots__/pv-after/`，檔名 `login.png` / `admin.png` / `admin-config.png`）均為具體值，無其他 placeholder。截圖為納入版控的 review 產物（Plan 2 移除 `.gitignore` 條目），`git add e2e/__screenshots__/pv-after ...` 可正常運作。

**Type consistency：** 本 plan 不寫 TypeScript 邏輯，僅改 CSS 與 JSX class/attribute；不引入 `any`（符合專案「一律不使用 any」）。每個落地 Task（3、4、5）皆以 `bun run typecheck && bun run build` 把關，Task 5 再跑完整 `lint + typecheck + test + build`。Task 4 明列「保留 island 依賴的 `id`/`name`/`data-lucide`/`role` 屬性不變」，確保視覺改動不破壞既有元件語意與 client 行為。

**依賴前置：** 本 plan 依賴 Plan 2 視覺 harness（`bun run test:visual`、`e2e/seed.ts`、baseline 截圖）與 P1–P6 完成後的視覺穩定 baseline；Task 1 對此設了確認 gate，缺失時 STOP 回報。
