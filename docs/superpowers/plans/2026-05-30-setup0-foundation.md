# Setup 0 — 基礎設施（防護 + 測試 + AI 資產）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在動任何重構前，建立供應鏈防護、commit-time secret 掃描、vitest 測試基礎設施與 AI agent 資產，作為後續所有階段的地基。

**Architecture:** 在既有 bun + simple-git-hooks + Vite/Workers 工具鏈上「合併式」加固，不替換既有設定；vitest 以獨立 `vitest.config.ts` 設定 happy-dom + `hono/jsx/dom` JSX runtime；AI 資產經 `/react-ai-infra`、`/harness-creator` 部署並剔除不適用於 Hono 的 React 專屬內容。

**Tech Stack:** bun ≥1.2、simple-git-hooks、gitleaks、vitest + happy-dom + @vitest/coverage-v8、hono/jsx/dom、APM (`/react-ai-infra`)、`/harness-creator`

> 對應 spec：`docs/superpowers/specs/2026-05-30-frontend-refactor-design.md` §5（Setup 0）、§7（測試）。視覺審查 harness 另見 Plan 2。

---

## File Structure

| 檔案 | 責任 | 動作 |
|---|---|---|
| `bunfig.toml` | bun 安裝防護（minimumReleaseAge） | Create |
| `package.json` | `trustedDependencies`、`simple-git-hooks` 設定、`test*` scripts、新增 devDeps | Modify |
| `vitest.config.ts` | vitest 設定（happy-dom + jsx runtime + coverage 範圍） | Create |
| `src/test/jsx-runtime.smoke.test.tsx` | 驗證 vitest 能跑 `hono/jsx/dom` 的 smoke test | Create |
| `apm.yml`、`.claude/skills/`、`.agents/skills/`、`.claude/rules/`、`.github/instructions/` | AI agent 資產（`/react-ai-infra` 產出） | Create（部分剔除） |
| `AGENTS.md` / `CLAUDE.md` | harness 區塊（`/harness-creator` 產出，整合不覆寫） | Modify |

---

## Task 1: bun 供應鏈防護（`/security-supply-chain`）

**Files:**
- Create: `bunfig.toml`
- Modify: `package.json`（新增 `trustedDependencies`）

- [ ] **Step 1: 確認 bun 版本 ≥ 1.2 與目前 linker**

Run: `bun --version && bun pm config get install.linker`
Expected: 版本 ≥ 1.2；記下 linker 值（若為 `hoisted` 則 Step 2 加入 `linker = "isolated"`）。

- [ ] **Step 2: 建立 `bunfig.toml`**

```toml
# bunfig.toml — 供應鏈防護
# 合併式設定，勿覆蓋既有 bunfig（本專案目前無此檔）。
[install]
# 拒絕安裝發佈未滿 7 天的版本（單位：秒，Bun >= 1.2），封住攻擊者發佈後的安裝窗口。
# 下限 259200（3 天），不得在無書面理由下調低。
minimumReleaseAge = 604800
```

> 註：**不啟用 `ignoreScripts`**（它會連 `trustedDependencies` 一併停用，過於激進）。lifecycle 腳本改用 `package.json` 的 `trustedDependencies` 白名單控制（Step 3）。若 Step 1 顯示 linker 為 `hoisted`，於 `[install]` 下加 `linker = "isolated"`。

- [ ] **Step 3: 在 `package.json` 新增 `trustedDependencies` 白名單**

於 `package.json` top-level 加入（僅允許確需執行 build/postinstall 的原生套件；本專案目前無，先留空陣列，安裝報錯時再逐一加入）：

```json
"trustedDependencies": []
```

- [ ] **Step 4: 驗證 age-gate 生效**

功能驗證須鎖定一個「真實存在且發佈未滿 7 天」的版本（unix-timestamp 版號只會得到 404「版本不存在」，無法觸發 age-gate）。查詢 npm registry 找出近期版本後嘗試安裝：

Run:
```bash
V=$(curl -s https://registry.npmjs.org/eslint | bun -e 'const t=JSON.parse(require("fs").readFileSync(0)).time; const now=Date.now(); const recent=Object.entries(t).find(([v,d])=>v!=="created"&&v!=="modified"&&(now-Date.parse(d))<6*86400e3); process.stdout.write(recent?recent[0]:"")'); echo "fresh=$V"; [ -n "$V" ] && bun add -d eslint@$V
```
Expected: 安裝被拒，訊息提及 `minimum-release-age`（kebab-case，bun）。若 `$V` 為空（該套件近 6 天內無新版），此測試不具結論性 — 註明並改換另一個近期活躍發佈的套件重試。

- [ ] **Step 5: Commit**

```bash
git add bunfig.toml package.json
git commit -m "chore(security): add bun minimumReleaseAge gate and trustedDependencies allowlist"
```

---

## Task 2: commit-time secret 掃描（gitleaks via simple-git-hooks）

**Files:**
- Modify: `package.json`（新增 `simple-git-hooks` 設定）

> 本專案用 `simple-git-hooks`（非 Python `pre-commit` 框架），故把 gitleaks 接進現有 hook 鏈，不引入新框架。現有 `.git/hooks/pre-commit` 跑 `bun run lint:fix`、`pre-push` 跑 `bun run typecheck`。

- [ ] **Step 1: 安裝 gitleaks**

Run: `brew install gitleaks && gitleaks version`
Expected: 印出版本（≥ 8.18）。

- [ ] **Step 2: 在 `package.json` 新增 `simple-git-hooks` 設定**

於 `package.json` top-level 加入（pre-commit 先掃 staged secret 再 lint；pre-push 維持 typecheck，test 於 Task 3 加入）：

```json
"simple-git-hooks": {
  "pre-commit": "gitleaks protect --staged --no-banner && bun run lint:fix",
  "pre-push": "bun run typecheck"
}
```

- [ ] **Step 3: 重新安裝 hooks 使設定生效**

Run: `bunx simple-git-hooks`
Expected: 輸出顯示 `pre-commit` / `pre-push` 已更新。

- [ ] **Step 4: 驗證 secret 掃描攔截**

```bash
printf 'const t = "ghp_0123456789abcdefghijklmnopqrstuvwxyzAB"\n' > /tmp/leak-probe.ts
git add -f /tmp/leak-probe.ts 2>/dev/null || cp /tmp/leak-probe.ts ./leak-probe.ts && git add leak-probe.ts
git commit -m "test: should be blocked" 2>&1 | tail -5
```
Expected: commit 被 gitleaks 擋下（finding: GitHub PAT）。
清理：`git restore --staged leak-probe.ts && rm -f leak-probe.ts /tmp/leak-probe.ts`

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "chore(security): scan staged changes for secrets with gitleaks pre-commit"
```

---

## Task 3: vitest 測試基礎設施（P0）

**Files:**
- Modify: `package.json`（devDeps + `test*` scripts + pre-push 加 test）
- Create: `vitest.config.ts`
- Create: `src/test/jsx-runtime.smoke.test.tsx`

- [ ] **Step 1: 安裝測試 devDependencies**

Run: `bun add -d vitest happy-dom @vitest/coverage-v8`
Expected: 三個套件加入 `devDependencies`（皆為成熟套件，不會被 age-gate 擋）。

- [ ] **Step 2: 建立 `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // client 元件以 hono/jsx/dom 渲染；測試環境統一此 JSX runtime
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'hono/jsx/dom',
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/client/lib/**', // 由 client-lib-layer plan 建立（P1）；此目錄尚不存在，刻意先列入，待該 plan 建立後即套用覆蓋率
        'src/utils/formAdaptor.ts',
        'src/services/subscription_cron.ts',
      ],
    },
  },
})
```

- [ ] **Step 3: 在 `package.json` `scripts` 新增測試指令**

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 4: 寫 smoke 失敗測試**

Create `src/test/jsx-runtime.smoke.test.tsx`：

```tsx
/** @jsxImportSource hono/jsx/dom */
import { render } from 'hono/jsx/dom'
import { describe, expect, it } from 'vitest'

describe('vitest + hono/jsx/dom runtime', () => {
  it('renders a component into a happy-dom node', () => {
    function Hello() {
      return <div id="hello">hi</div>
    }
    const root = document.createElement('div')
    render(<Hello />, root)
    expect(root.querySelector('#hello')?.textContent).toBe('hi')
  })
})
```

- [ ] **Step 5: 跑測試確認可執行並通過**

Run: `bun run test`
Expected: PASS（1 test）。若 JSX 解析失敗，檢查 `vitest.config.ts` 的 `jsxImportSource`。

- [ ] **Step 6: 在 pre-push 加入 test**

把 `package.json` 的 `simple-git-hooks.pre-push` 改為：

```json
"pre-push": "bun run typecheck && bun run test"
```

Run: `bunx simple-git-hooks`
Expected: pre-push hook 更新。

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock vitest.config.ts src/test/jsx-runtime.smoke.test.tsx
git commit -m "test: bootstrap vitest with happy-dom and hono/jsx/dom runtime"
```

---

## Task 4: AI agent 資產部署（`/react-ai-infra`）

**Files:**
- Create: `apm.yml`、`.claude/skills/*`、`.agents/skills/*`、`.claude/rules/*`、`.github/instructions/*`
- Modify: `.gitignore`（`apm install` 會追加 `apm_modules/`）

> 此為互動式 skill 執行；產物由 skill 生成，本任務的「程式碼」是驗證與剔除步驟。

- [ ] **Step 1: 確認 `apm` CLI 已安裝**

Run: `apm --version`
Expected: 印出版本。若 `command not found` → 先安裝（macOS：`curl -sSL https://aka.ms/apm-unix | sh` 或 `brew install microsoft/apm/apm`），再繼續。

- [ ] **Step 2: 執行 `/react-ai-infra`**

於 Claude Code 對話呼叫 `/react-ai-infra`。框架選擇 **`vite-react`**（slug 3）。targets 取 `claude` + `agent-skills`（依偵測，可含 `copilot`）。
Expected：skill 產生 `apm.yml`、執行 `apm install`（建立 `apm_modules/` 並把 `apm_modules/` 追加進 `.gitignore`）、複製 skills/rules、`vite-react` 無 AGENTS.md 模板故 Step 7 乾淨略過（不覆寫既有 `AGENTS.md`）。

- [ ] **Step 3: 剔除不適用於 Hono 的 React 專屬資產**

本專案用 `hono/jsx`（非 React）。移除/停用 skill 帶入的 React 專屬內容：

```bash
rm -rf .claude/skills/no-use-effect .agents/skills/no-use-effect
rm -f .claude/rules/react-components.md .github/instructions/react-components.instructions.md
```

審查 `apm.yml` 的 `dependencies`，移除 React 專屬套件（如 `react-best-practices`），僅保留與 Hono/Vite 相容或框架無關的項目。

- [ ] **Step 4: 確認 `apm_modules/` 已被 ignore**

Run: `grep -q 'apm_modules' .gitignore && echo OK`
Expected: `OK`。

- [ ] **Step 5: Commit**

```bash
git add apm.yml .gitignore .claude/ .agents/ .github/
git commit -m "chore(ai): deploy APM agent assets (vite-react), prune React-only skills/rules"
```

---

## Task 5: harness 基礎設定（`/harness-creator`）

**Files:**
- Modify: `AGENTS.md`、`CLAUDE.md`（新增 harness 區塊，整合不覆寫）

> 互動式 skill 執行；驗證重點是「既有 OpenSpec / GitNexus 受管區塊未被破壞」。

- [ ] **Step 1: 執行 `/harness-creator`**

於對話呼叫 `/harness-creator`，建立本次重構的 harness：
- **scope boundary**：前端 client 層 + cron 兩缺陷；明列不可動範圍（API envelope、路由、KV 邏輯）。
- **verification workflow**：`bun run lint && bun run typecheck && bun run test && bun run build` + 視覺 harness 截圖（Plan 2）。
- **feature state / memory persistence / tool safety**：跨 session 接手與高風險操作（KV 寫入、deploy、release）邊界。

- [ ] **Step 2: 驗證既有受管區塊完整**

Run: `grep -c 'OpenSpec Instructions' AGENTS.md CLAUDE.md && grep -c 'GitNexus — Code Intelligence' AGENTS.md CLAUDE.md`
Expected: 既有 OpenSpec 與 GitNexus 區塊仍存在（計數 ≥ 1），harness 內容為「新增」而非「取代」。

- [ ] **Step 3: 確認專案檢查仍全綠**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: 全部通過（此時尚無重構程式碼變更，僅文件與設定）。

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md CLAUDE.md
git commit -m "chore(harness): add refactor scope, verification and lifecycle harness blocks"
```

---

## Task 6: 更新套件到可防護的最新版本

**Files:**
- Modify: `package.json`、`bun.lock`

> 依賴 Task 1 的 age-gate：`minimumReleaseAge = 604800` 會讓 resolver 自動跳過發佈未滿 7 天的版本，因此 `bun update --latest` 解析到的就是「**最新且已過防護窗口**」的版本。更新後以已建好的 test/build 驗證，最後執行，便於一次攔截升級造成的破壞。

- [ ] **Step 1: 檢視可更新項目**

Run: `bun outdated`
Expected: 列出 current / update / latest 欄位。記下含 major 升級的套件（可能需要程式調整）。

- [ ] **Step 2: 升級到 age-gate 允許的最新版**

Run: `bun update --latest`
Expected: `package.json` 與 `bun.lock` 更新；因 age-gate 生效，未滿 7 天的最新版會被跳過（解析到次新的安全版），不應出現 `minimum-release-age` 阻擋以外的錯誤。

- [ ] **Step 3: 檢視變更幅度**

Run: `git diff package.json`
Expected: 確認升級範圍；對 major 升級（如 lint/build 工具）特別留意。

- [ ] **Step 4: 全套驗證**

Run: `bun run lint && bun run typecheck && bun run test && bun run build`
Expected: 全部通過。若某 major 升級造成破壞，於本步修正（或將該套件回退並在 commit message 註明原因）。

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock
git commit -m "chore(deps): update dependencies to latest age-gate-safe versions"
```

---

## Self-Review

**1. Spec coverage（對 spec §5.1/§5.2/§5.3 + §7 + P0）：**
- §5.1 供應鏈防護 → Task 1（bunfig minimumReleaseAge + trustedDependencies）+ Task 2（gitleaks）✓
- §5.2 react-ai-infra（含 React 資產剔除）→ Task 4 ✓
- §5.3 harness-creator（整合不覆寫）→ Task 5 ✓
- §7 / P0 vitest bootstrap → Task 3 ✓
- 依賴更新到可防護最新版（age-gate-safe）→ Task 6 ✓
- §5.4 視覺審查 harness → **不在本 plan**（移至 Plan 2，已於開頭註明）

**2. Placeholder scan：** 無 TBD/TODO；互動式 skill 任務（4/5）已以具體驗證指令與剔除清單取代模糊描述。

**3. Type consistency：** 本 plan 不定義跨任務型別/函式簽名（屬設定與基礎設施）；`test` script 在 Task 3 定義後，Task 3 Step 6 才於 pre-push 引用，順序一致。

---

## Execution Handoff

完成本 plan 後，後續尚有：Plan 2（視覺審查 harness）、Plan 3（lib 層 P1）、Plan 4（後端 cron P2）、Plan 5（islands P3–P6）、Plan 6（視覺提升 PV）、Plan 7（收尾 P7）。
