# 收尾與清理 (P7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 作為前端重構（S0→PV）的最後一個階段，對整條 `refactor/frontend-client-layer` 分支做收尾：移除 AI 生成的 code slop、跑完整檢查套件至全綠、確認覆蓋率閘門達標、做最終視覺前後確認，並把分支整理到「ready for PR」狀態（不自動 merge、不自動建 PR）。

**Architecture:** 維持既有分層（Hono SSR pages/components + Vite island scripts + `src/client/lib/` 共用層 + `e2e/` 視覺 harness）。本階段**不新增 runtime 程式碼、不改變架構**，只做清理、驗證與分支整理。所有實際的程式碼變更僅限於「移除 slop」與「修正檢查套件回報的失敗」，且每次修正都應落在既有檔案上。

**Tech Stack:** Cloudflare Workers + Hono + `hono/jsx/dom`；Vite 6；TypeScript（strict，禁用 `any`）；Tailwind v4 + DaisyUI；Vitest + happy-dom + @vitest/coverage-v8（P0 引入）；@playwright/test（S0 引入）；套件管理 **bun**；git hooks 用 `simple-git-hooks`（pre-commit: gitleaks + `lint:fix`；pre-push: `typecheck` + `test`）。

---

## File Structure

> 本階段**不新增 runtime 檔案**。變更為「跨分支既有檔案的清理修正」，集中在 client 層與 cron。下表列出**可能**被 slop 清理或修正觸及的既有檔案範圍，以及本階段唯一會新增/更新的非程式碼產物（最終 baseline 截圖、可選的 PR 草稿文字）。

| 路徑 | 類型 | 本階段動作 |
|---|---|---|
| `src/client/lib/api.ts` | 修改（既有） | 清 slop（多餘註解、防禦式 try/catch、`as any`） |
| `src/client/lib/dom.ts` | 修改（既有） | 清 slop |
| `src/client/lib/async-ui.ts` | 修改（既有） | 清 slop |
| `src/client/lib/icons.ts` | 修改（既有） | 清 slop |
| `src/client/lib/store.ts` | 修改（既有） | 清 slop |
| `src/client/admin/**` | 修改（既有） | 清 slop |
| `src/client/config/**` | 修改（既有） | 清 slop |
| `src/client/login/**` | 修改（既有） | 清 slop |
| `src/components/config/PasskeyList.tsx`、`PasskeyItem.tsx` | 修改（既有） | 清 slop |
| `src/utils/formAdaptor.ts` | 修改（既有） | 清 slop（`periodMethod` 型別） |
| `src/services/subscription_cron.ts` | 修改（既有） | 清 slop（immutable helper） |
| `src/services/notifier/index.ts`、`src/index.tsx` | 修改（既有） | 清 slop（`getCurrentHour`） |
| `e2e/visual.spec.ts`、`e2e/seed.ts`、`e2e/playwright.config.ts` | 修改（既有） | 清 slop |
| `vitest.config.ts` | 修改（既有） | 清 slop |
| `e2e/__screenshots__/baseline/`、`e2e/__screenshots__/pv-after/` | 產物（非程式碼，納入版控） | 重新擷取最終截圖（`login.png` / `admin.png` / `admin-config.png`）供審查；截圖未被 gitignore，正常 commit |
| `AGENTS.md` / `CLAUDE.md` | 修改（既有） | 僅在收尾發現受管區塊外的 harness 文件需同步時 |

> 註：若任一檔案在前置階段（S0–PV）並未實際產生，清理時直接跳過即可——本計畫以「diff 對照 main 出現的檔案」為準，不臆測檔案存在。

---

## Task 1 — AI code-slop 清理 pass

**Files:** 整條分支 `git diff main...HEAD` 範圍內的所有既有檔案（見 File Structure 表）。依 `.claude/rules/remove_code_slop.md` 執行。

- [ ] **Step 1** 確認位於正確分支且工作區乾淨，取得待清理的完整 diff 範圍：
  ```bash
  git branch --show-current        # 預期輸出：refactor/frontend-client-layer
  git status --porcelain           # 預期輸出：空（無未提交變更）
  git diff main...HEAD --stat       # 列出本分支相對 main 的所有變更檔案與增減行數
  ```
  預期：`git status --porcelain` 無輸出；`--stat` 列出 S0→PV 累積的所有檔案。若工作區不乾淨，先 stash 或 commit 再繼續。
- [ ] **Step 2** 逐檔審視完整 diff 內容，標記 slop：
  ```bash
  git diff main...HEAD              # 完整 diff，逐檔閱讀
  ```
  依下列 checklist 標記每一處 slop（對照 `.claude/rules/remove_code_slop.md`）：
  - [ ] **多餘註解**：人類不會加、或與該檔其餘風格不一致的解釋性註解（例如 `// 解開 envelope` 這類複述程式碼的註解）。
  - [ ] **異常防禦**：對該區域而言不正常的額外 try/catch 或 null 檢查，特別是被「已驗證 / 受信任」呼叫路徑呼叫的程式碼（例如 lib 層被 island 以 typed 介面呼叫後又重複防禦）。
  - [ ] **`as any` / `as unknown as`**：任何為繞過型別問題而做的 `any` 轉型（spec §2 明定 client 層須零 `any`）。
  - [ ] **風格不一致**：命名、引號、排版、import 順序等與所在檔案/鄰近檔案不一致之處。
  - [ ] **冗餘抽象**：只被呼叫一次卻包了一層的小函式、未使用的 export、dead code。
- [ ] **Step 3** 針對 lib 層的呼叫端做重點檢查（spec §1 列出的 8 項問題收斂目標）：
  - [ ] `fetch` 只剩 `api.ts` 一套（呼叫端無重複 `response.ok` / `json() as` / `data.data && Array.isArray(...)` 防禦）。
  - [ ] loading 只剩 `async-ui.ts` 的 `withLoading` 一套（無散落的 disable/icon/finally 樣板）。
  - [ ] 渲染只剩 `hono/jsx/dom` 一套（無殘留 `innerHTML` 字串樣板、無 `window.x` 全域暴露、無 inline `onclick=""`）。
  - [ ] lucide 只剩 `icons.ts` 的 `renderIcons` 一套（無殘留 `window.lucide.createIcons()`）。
- [ ] **Step 4** 移除標記到的 slop。每次移除後保持改動最小、不引入新風格；不要為了「整理」而重寫未列為 slop 的程式碼。
- [ ] **Step 5** 局部驗證清理未破壞型別與 lint：
  ```bash
  bun run lint && bun run typecheck
  ```
  預期：兩者皆 0 error（lint 可能 auto-fixable 警告，交由 `lint:fix` 處理）。若 `as any` 移除後出現型別錯誤，**修正型別本身**（補正確型別），不得用新的 `any` 規避。
- [ ] **Step 6** 依 `.claude/rules/remove_code_slop.md` 要求，產出 **1–3 句**的清理摘要（描述移除了哪些類別的 slop、約略影響哪些檔案），記錄於本 Task 的執行回報中。
- [ ] **Step 7** Commit（僅在確有清理變更時）：
  ```bash
  git add -A
  git commit -m "refactor(client): remove AI-generated code slop across refactor branch"
  ```
  注意：pre-commit hook 會跑 gitleaks + `lint:fix`；若 hook 自動 fix 了檔案，重新 `git add -A` 後再 commit。**不要**加 `Co-Authored-By` trailer。

---

## Task 2 — 完整檢查套件全綠

**Files:** 無新增；僅在套件回報失敗時修正既有檔案。

- [ ] **Step 1** 執行完整檢查套件（順序固定，遇錯即停）：
  ```bash
  bun run lint && bun run typecheck && bun run test && bun run build
  ```
  預期：
  - `lint`：0 error。
  - `typecheck`：`tsc --noEmit` 0 error。
  - `test`：所有 Vitest 測試 PASS（含 lib / formAdaptor / cron / JSX smoke test）。
  - `build`：`vite build` 成功，輸出 `index.js`，無警告（特別注意未超過 Workers 1MB bundle 限制）。
- [ ] **Step 2** 若任一步驟失敗：
  - lint 失敗 → 先 `bun run lint:fix` 自動修，殘餘手動修。
  - typecheck 失敗 → 修正型別（禁用 `any`）。
  - test 失敗 → **修實作，不要改測試來遷就**（除非測試本身寫錯）；spec §7 為 TDD，行為由測試鎖定。
  - build 失敗 → 對照 `AGENTS.md` Troubleshooting（`nodejs_compat`、bundle size、缺套件）。
  修正後**重跑整串**直到全綠。
- [ ] **Step 3** Commit（僅在為修正失敗而改動程式碼時）：
  ```bash
  git add -A
  git commit -m "fix(client): resolve check-suite failures (lint/typecheck/test/build)"
  ```
  不要加 `Co-Authored-By` trailer。

---

## Task 3 — 覆蓋率閘門 (≥80%)

**Files:** 無新增；若覆蓋不足則補既有測試檔（`*.test.ts`）。

- [ ] **Step 1** 產生覆蓋率報告：
  ```bash
  bun run test:coverage
  ```
  預期：終端輸出 coverage table，且整體與下列 `include` 集合各檔皆達門檻。
- [ ] **Step 2** 對照 spec §2／§7 的覆蓋目標，確認下列 coverage `include` 集合 **每一項 ≥ 80%**（statements / branches / functions / lines）：
  - [ ] `src/client/lib/**`（`api.ts` / `dom.ts` / `async-ui.ts` / `store.ts` / `icons.ts`）
  - [ ] `src/utils/formAdaptor.ts`
  - [ ] `src/services/subscription_cron.ts`
- [ ] **Step 3** 若任一目標 < 80%：補對應的單元測試（純函式 / 可注入相依，依 spec §7：`api` 注入 mock fetch、`processSubscriptionReminder` 須含「輸入物件未被 mutate」斷言），重跑 `bun run test:coverage` 直到達標。**不得**靠調整 `include`/`exclude` 來灌水覆蓋率以規避閘門。
- [ ] **Step 4** Commit（僅在補了測試時）：
  ```bash
  git add -A
  git commit -m "test(client): raise coverage to >=80% on lib/formAdaptor/cron"
  ```
  不要加 `Co-Authored-By` trailer。

---

## Task 4 — 最終視覺確認

**Files:** `e2e/__screenshots__/**`（重新擷取的最終截圖，非程式碼產物）。

- [ ] **Step 1** 跑視覺 harness，產生 PV 後的最終截圖：
  ```bash
  bun run test:visual
  ```
  預期：Playwright 透過 S0 harness（`wrangler dev` 服務 build 後 Worker + `e2e/seed.ts` 注入 admin config／範例訂閱 + `POST /api/login` 取 cookie）成功截圖 `/`(login)、`/admin`、`/admin/config` 至 `e2e/__screenshots__/pv-after/`（檔名 `login.png` / `admin.png` / `admin-config.png`，config 頁對應 `/admin/config`），全部 pass。
  > 若 `test:visual` script 不存在或 harness 需手動啟服務，依 spec §5.4：`bun run build` 後以 `wrangler dev`（備援 `vite preview --port 4173`）服務 Worker，再執行 Playwright spec。
- [ ] **Step 2** 啟動 production build 預覽，人工確認 UI 行為：
  ```bash
  bun run preview
  ```
  預期：build 成功並起本機 preview server。手動確認：
  - [ ] login / admin / config 三頁可正常載入、互動（按鈕 loading、表格渲染、passkey 列表、modal）無回歸。
  - [ ] 圖示（lucide）正常顯示。
  - [ ] 無 console error。
- [ ] **Step 3** 視覺前後對比：將 Task 4 的最終截圖（`e2e/__screenshots__/pv-after/` 的 `login.png` / `admin.png` / `admin-config.png`）與 **S0 baseline**（`e2e/__screenshots__/baseline/` 同名檔，重構前）對照，確認：
  - [ ] PV 視覺方向（使用者已選定的 DaisyUI 主題 / Tailwind theme）正確套用且一致。
  - [ ] P1–P6 的結構/邏輯重構**未造成非預期視覺回歸**（spec §8 註：P1–P6 視覺應穩定）。
  將對比結論交 frontend-design 與使用者審查核可（此為人工 gate）。
- [ ] **Step 4** Commit 最終截圖。截圖為納入版控的 review 產物（S0 harness 已移除 `e2e/__screenshots__/` 的 `.gitignore` 條目），故正常 commit baseline 與 pv-after 兩組（檔名 `login.png` / `admin.png` / `admin-config.png`）供審查對比：
  ```bash
  git add e2e/__screenshots__/baseline e2e/__screenshots__/pv-after
  git commit -m "test(visual): commit final baseline and pv-after screenshots for review"
  ```
  不要加 `Co-Authored-By` trailer。

---

## Task 5 — 分支整理至 Ready for PR（不自動 merge / 不自動建 PR）

**Files:** 無程式碼變更；輸出為 commit 整理結論 + 建議 PR 標題/內文大綱。

- [ ] **Step 1** 最終跑一次完整檢查套件，確保收尾後仍全綠：
  ```bash
  bun run lint && bun run typecheck && bun run test && bun run build
  ```
  預期：全綠。
- [ ] **Step 2** 彙整本分支相對 main 的 commit 歷史：
  ```bash
  git log main..HEAD --oneline
  git diff main...HEAD --stat
  ```
  逐一核對每個 commit 是否符合 Conventional Commits（Angular convention，見 `AGENTS.md` PR Instructions）：型別屬 `feat|fix|refactor|perf|test|docs|style|chore`，scope 取自 `subscriptions|crypto|kv|routes|ui|config|client|cron` 等。
- [ ] **Step 3** 若有不合規的 commit message：在**本地** rebase 修正（不可改寫已被他人共用的歷史；本分支為個人 feature 分支可整理）。注意：互動式 rebase（`-i`）在此環境不支援，需以非互動方式處理或交由使用者於本機整理；若無法非互動修正，於回報中標示「待使用者本機 reword 的 commit 清單」。
- [ ] **Step 4** 確認分支已與 main 對齊（檢查是否落後，供使用者決定是否 rebase/merge main）：
  ```bash
  git fetch origin
  git log --oneline origin/main..HEAD     # 本分支領先 origin/main 的 commits
  git log --oneline HEAD..origin/main     # origin/main 領先本分支的 commits（若非空，提示使用者需先同步）
  ```
  不在本計畫內自動 rebase/merge——僅回報落後狀態交使用者決策。
- [ ] **Step 5** 產出**建議的 PR 標題與內文大綱**（不執行 push、不執行 `gh pr create`）：
  - **建議 PR 標題**：
    `refactor(client): unify client lib layer, visual uplift, and AI review infra`
  - **建議 PR 內文大綱**：
    ```markdown
    ## Summary
    - 統一 client 層為 hono/jsx/dom 單一渲染風格，抽出 src/client/lib/（api/dom/async-ui/icons/store）消除重複樣板
    - 清除所有 as any / as unknown as，移除 window 全域暴露與 inline onclick
    - 修正後端 cron 兩缺陷：getCurrentHour(config) 統一時區、processSubscriptionReminder 改為 immutable
    - 引入 Vitest + happy-dom 測試基礎設施，lib/formAdaptor/cron 覆蓋 >=80%
    - 視覺提升（PV）：客製 DaisyUI 主題 + Tailwind theme，套用 login/admin/config
    - 新增 AI 視覺審查 harness（wrangler + Playwright 截圖）與供應鏈/agent 基礎設施（S0）

    ## Test plan
    - [ ] bun run lint
    - [ ] bun run typecheck
    - [ ] bun run test（含 JSX smoke + lib + formAdaptor + cron mutation 斷言）
    - [ ] bun run test:coverage（lib/** + formAdaptor.ts + subscription_cron.ts 均 >=80%）
    - [ ] bun run build（輸出 index.js，未超 Workers 1MB）
    - [ ] bun run test:visual + bun run preview：login/admin/config 截圖前後對比、無功能回歸
    - [ ] frontend-design 與使用者已核可 PV 視覺方向

    ## Notes
    - 無新增 runtime 依賴（vitest/happy-dom/@playwright/test 皆 devDep，不影響 Workers bundle）
    - 未改 API envelope 格式或路由路徑
    - 變更分階段獨立 commit，PV 視覺改動可單獨 revert
    ```
- [ ] **Step 6** **停在此處（Ready for PR）。** push 分支與建立 PR 屬 user-gated action，需使用者明確指示後才執行（屆時用 `git push -u origin refactor/frontend-client-layer` 與 `gh pr create`）。本計畫不自動 push、不自動 merge。於回報中明確標示「分支已就緒，等待使用者授權 push / 開 PR」。

---

## Self-Review

**Spec success-criteria 覆蓋（spec §2）**
- 「`bun run lint && bun run typecheck && bun run test && bun run build` 全綠」→ Task 2 Step 1 完整命令 + 全綠預期；Task 5 Step 1 收尾再驗一次。
- 「client 層無 `any`；fetch / loading / 渲染各只有一套標準做法」→ Task 1 Step 2（`as any` checklist）+ Step 3（單一 api/withLoading/jsx/icons 收斂檢查）。
- 「lib 層 + adaptor + cron 邏輯單元測試覆蓋 ≥ 80%」→ Task 3 對 `src/client/lib/**`、`src/utils/formAdaptor.ts`、`src/services/subscription_cron.ts` 逐項 80% 閘門。
- 「視覺提升經 Playwright 前後截圖對比、由 frontend-design 與使用者審查核可；功能行為無非預期回歸」→ Task 4（`test:visual` + `preview` + baseline/PV 前後對比 + 人工核可 gate）。

**Spec §8 P7 範圍對齊**：清 slop（Task 1，依 `.claude/rules/remove_code_slop.md` 含 1–3 句摘要要求）／lint+typecheck+test+build 全綠（Task 2）／截圖最終確認（Task 4）皆涵蓋；額外補上覆蓋率閘門（Task 3，spec §2/§7 要求）與分支整理至 ready-for-PR（Task 5，符合 git-workflow 與 user-gated push/PR）。

**Placeholder 掃描**：全文無 `TODO`、`<...>`、`xxx`、`TBD` 等佔位符；所有命令為可直接執行的具體指令；PR 標題/內文為具體文字而非佔位。

**一致性檢查**：
- 套件管理一律 `bun run ...`，與 `package.json` scripts 及 `AGENTS.md` 一致；`test` / `test:coverage` / `test:visual` 由前置階段（P0 / S0）引入，本計畫假定其已存在並在缺漏時給備援路徑。
- Commit 訊息全用 Conventional Commits（Angular），**無** `Co-Authored-By` trailer（符合本任務要求與專案 hooks 設定）。
- 尊重 `simple-git-hooks`（pre-commit: gitleaks + `lint:fix`；pre-push: `typecheck` + `test`）——Task 1 Step 7 已提示 hook 自動 fix 後需重新 `git add`。
- 不自動 push / merge / 建 PR（user-gated），與專案 git 規範一致。
- 散文 Traditional Chinese、命令與識別字 English，符合格式要求。
