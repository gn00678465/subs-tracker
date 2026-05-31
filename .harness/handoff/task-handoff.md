---
schema_version: 1
artifact_type: task-handoff
last_updated: 2026-05-31T20:25:00+08:00
last_writer: claude-opus-4-8
task_id: frontend-client-layer-refactor
---

# Task Handoff · 前端 client 層重構（S0→P7）已開 PR #7

> 註：`task_id` 為跨 S0–P7 的傘狀任務，`.harness/contract/` 下只有 `rwd-visual-review`（其中一個子任務）對應目錄；validator 對 task_id 無對應 contract 目錄的 warn 為預期。

## 1. 當前已驗證

- 完整自動化 gate 全綠：`bun run lint && bun run typecheck && bun run test && bun run build`
- 覆蓋率閘門 per-file ≥80%：`bun run test:coverage`（cron 97.6 / api 96.2 / formAdaptor 95.5 / lib ~100）
- 視覺 harness 在 production build 4/4 pass：`bun run test:visual`（mobile Pixel 5 + desktop，三頁）
- Live UI 驗證（chrome-devtools MCP）：login 錯誤/正確帳密、admin、config、light + dark，全部語意色對比 ≥ WCAG AA
- 分支已 push 並開 PR #7：`https://github.com/gn00678465/subs-tracker/pull/7`（7 commits，+7714/-1071）
  - evidence: 無入庫證據（截圖刻意 untracked，darwin 專屬本機產物）

## 2. 本輪改動

### Code 改動
- src/style.css: 套用 Starbucks DESIGN.md 主題 + 補齊語意色 `-content` token 修正 WCAG-AA 對比 + 深色 neutral/success 徽章可讀性
- src/pages/Admin.tsx: 列表 card 加 `overflow-hidden`，四角圓角一致
- src/components/Layout.tsx: PWA `theme-color` 改 `#00754A`
- src/client/icons.ts: 收斂為呼叫 lib/icons.ts 的 renderIcons，移除 `(window as any).lucide` 死碼
- e2e/visual.spec.ts、playwright.config.ts: 雙視口（mobile + desktop）RWD + design-token 斷言、forced-dark 擷取、動效凍結
- src/services/subscription_cron.test.ts、vitest.config.ts: 補 cron 測試至 97.6%，加 per-file 80% threshold
- e2e/seed.ts、e2e/constants.ts: side-effect-free 常數、import.meta.main guard（修雙重 seed）

### Infra / config / env 改動
- git history: 52 → 7 grouped commits（soft-reset + per-group partial commit）；`git diff backup/refactor-pre-squash HEAD` 為空證明 tree 不變
- backup/refactor-pre-squash: 整理前 52-commit 歷史的安全網（HEAD eded3b4）
- .mcp.json: chrome-devtools MCP（live 視覺/對比審查用）
- GitNexus: 已 reindex（1498 symbols）

## 3. 仍損壞或未驗證

### D-001
- component_type: other
- 為何 other: 屬產品 UI/RWD 設計缺陷（行動版觸控目標過小），非 agent-harness 的 tool/skill/middleware/prompt/memory 類
- severity: MINOR
- where: src/components/admin/SubscriptionTableRow.tsx 的 `.btn-xs` 列操作鈕（`#subscriptionsBody` 內），mobile ≤393px
- reproduce: 開 /admin 於 mobile viewport（Pixel 5 393x851），量 `.btn-xs` 高度 = 24px（< 40/44px 舒適觸控目標）；由 e2e/visual.spec.ts 的 AC#6b 非阻擋探針顯示
- 已知 / 推測原因: DaisyUI `btn-xs` 尺寸 ~24px，未在行動版斷點放大；建議後續以 `min-h-10` @ mobile 修，屬獨立 remediation story（本輪刻意不修，review-only）

### D-002
- component_type: other
- 為何 other: 既有 tooling false-positive，非本分支程式碼缺陷
- severity: MINOR
- where: .serena/memories/Notification_System_Configuration_Guide.md（commit 947fc272，位於 main，2025-12-23）
- reproduce: `gitleaks git`（不帶 range，掃全史）→ leaks found 1；命中的是 curl 範例 auth header 內的 `YOUR_TOKEN` 佔位符（非真實 token）
- 已知 / 推測原因: 文件中的 curl 範例佔位符，非真實 secret；不在 `main..HEAD` 範圍（分支範圍掃描乾淨）。掃分支時務必用 `--log-opts="main..HEAD"`

## 4. 下一步最佳動作

### 建議的 next task
等待 PR #7 的 review 與 CI；通過後 merge（user-gated，勿自動 merge）。merge 後再以獨立分支處理 D-001（行動版列操作鈕觸控目標放大），不要混進已 PR 的本分支。

### Don't touch list
- src/routes/: 路由路徑與 handler 契約凍結——behaviour-preserving refactor 的不可動範圍，改動會破壞既有 API 行為
- src/utils/response.ts: API envelope `{ success, data, message }` 形狀凍結，下游所有 island 依賴此 shape
- src/services/: KV 讀寫語意（key schema、read/write 行為）凍結；cron 兩缺陷除外（已於本輪完成）

### Blockers
- 無 blocker（PR #7 已開，等人工 review / CI）。注意：`backup/refactor-pre-squash` 分支在 PR #7 merge 前請保留，為 52→7 整理的還原安全網

## 5. 命令

**Shell**: bash

### Start
```bash
# 安裝相依
bun install
# 啟動 dev（必須在 tmux 內，否則 PreToolUse hook 會擋住 dev server）
tmux new-session -d -s dev "bun run dev"
# 注意：本機 KV 的 config 已被 visual-harness seed 覆寫，
# 登入帳密為 admin / visual-harness-pw（非預設 admin / password）
```

### Verify
```bash
# 完整自動化 gate
bun run lint && bun run typecheck && bun run test && bun run build

# 覆蓋率閘門（per-file >=80%）
bun run test:coverage

# 視覺 harness（本機；mobile + desktop；darwin 專屬基準，未入庫）
bun run test:visual
```

### Debug
```bash
# 只掃本分支範圍的 secret（排除 main 既有的 YOUR_TOKEN false-positive）
gitleaks git --no-banner --log-opts="main..HEAD"

# 還原整理 commit 前的 52-commit 歷史
git reset --hard backup/refactor-pre-squash
```
