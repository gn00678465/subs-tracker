# 部署研究：用 Workers Builds 在推送 tag 時部署

- 查核日期：2026-09-26
- 範圍：把 subs-tracker 的部署改為 Cloudflare Workers Builds（Cloudflare 的 Git 整合）。需求：`main` 更新時不部署；推送 git tag（例如 `v1.3.0`）時才部署到正式環境。本文研究可行做法、各做法的限制、D1 migration、API token、回滾與額度，最後列出遷移步驟。
- 前提條件：只有一個使用者，由部署者自架（`PRODUCT.md`）；GitHub repo `gn00678465/subs-tracker` 是公開 repo，`main` 沒有 branch protection，也沒有 ruleset（`gh api`，2026-09-26）；部署目前是手動的 `bun run deploy`；GitHub Actions 部署流程已在 commit `e675c17` 刪除。
- 標記：
  - 〔查證〕：來自 Cloudflare 官方文件、Cloudflare changelog、Cloudflare API 文件、wrangler 原始碼，或本 repo 的檔案，附出處。
  - 〔實測〕：在 scratchpad 的專案複本或暫時的 git repo 中執行得到的結果。本 repo 的檔案沒有變更。
  - 〔推論〕：由查證事實推得，沒有直接證據。
  - 「查不到」：官方資料沒有寫，本文不猜。
- 驗證方法：2026-09-26 從 `developers.cloudflare.com/<path>/index.md` 下載文件，從 `developers.cloudflare.com/changelog/rss/index.xml` 讀 changelog。閱讀 `node_modules/wrangler/wrangler-dist/cli.js`（wrangler 4.141.0）與 `node_modules/bumpp/dist/config-CadB_BQ2.mjs`（bumpp 12.3.0）。在 scratchpad 複製專案（`git ls-files`，`node_modules` 以 symlink 連到本 repo），執行 `bun run build`、`wrangler deploy --dry-run`、`wrangler d1 migrations apply DB --local`。另建兩個暫時的 git repo（bare remote + 工作目錄），模擬 `bun run release` 的 tag 流程。沒有連線到 Cloudflare，沒有部署，沒有在 GitHub 建立或修改任何東西。

---

## 1. 摘要與建議

### 1.1 最重要的發現

1. **Workers Builds 不能以 git tag 觸發建置。** 文件只寫「分支」：production branch 的每一次 push 執行 build command 與 deploy command；其他分支執行 preview build〔查證：Build branches〕。Trigger 的篩選欄位只有 `branch_includes`、`branch_excludes`、`path_includes`、`path_excludes`〔查證：Builds API reference〕。手動建置 API 只接受 `branch` 或 `commit_hash`〔查證：Start a Workers build〕。建置紀錄的 `build_trigger_source` 只有 `push`、`pull_request`、`manual`、`api`〔查證：Workers Builds API〕。文件沒有提到 tag。
2. **現在的 `bun run release` 不會把 tag 推到 GitHub。** `bumpp` 在版號 commit 上建立 annotated tag，接著腳本用 `git commit --amend` 把 `CHANGELOG.md` 併入 commit。amend 產生新的 commit，tag 仍然指向舊的 commit。舊的 commit 不在 `main` 上，所以 `git push --follow-tags` 不推送這個 tag〔實測〕。以 tag 為部署依據之前，必須先修正這個問題（第 10 節）。現有的 `v1.1.0`…`v1.2.0` 是 lightweight tag，指向 `main` 上的 merge commit，不是這個腳本建立的〔查證：`git cat-file -t`、`git ls-remote --tags origin`〕。
3. **Workers Builds 自動建立的 API token 沒有 D1 權限。** 權限是 Account Settings (read)、Workers Scripts (edit)、Workers KV Storage (edit)、Workers R2 Storage (edit)、Workers Routes (edit)、User Details (read)、Memberships (read)〔查證：Configuration「API token」〕。`wrangler d1 migrations apply DB --remote` 要呼叫 D1 API，所以要在這個 token 加上 **D1 Edit**，或改選一個有 D1 Edit 的 user token。
4. **`wrangler.toml` 沒有 `database_id` 仍可在 Workers Builds 部署。** `wrangler deploy` 會依序：沿用已部署 Worker 上的 `DB` binding → 依 `database_name = "subs-tracker"` 找現有的資料庫 → 都找不到時自動建立一個新的資料庫〔查證：wrangler 原始碼〕。最後一種情況會讓 Worker 連到一個空的資料庫。把 migration 放在 `wrangler deploy` 之前，可以擋住這種情況：資料庫不存在時，migration 指令先失敗〔查證：wrangler 原始碼〕。
5. **目前正式環境的 Worker 名稱不確定。** `main` 上的舊 `wrangler.toml` 用 `[env.production] name = "subscription-manager"`，舊的 `deploy.yml` 執行 `deploy --env production`〔查證：`git show origin/main:wrangler.toml`、`git show e675c17^:.github/workflows/deploy.yml`〕。現在的 `wrangler.toml` 只有 `name = "subs-tracker"`。Workers Builds 要求 Dashboard 上的 Worker 名稱與 `name` 相同〔查證：Troubleshooting builds〕。要連結哪一個 Worker，由使用者在 Dashboard 確認（第 7 節）。

### 1.2 建議

**採用專用的部署分支 `release`（第 2.2 節方案 A）。**

- Dashboard：production branch 設為 `release`，關閉 preview builds。推送 `main` 不會建置，也不會部署〔查證：Build branches〕。
- 發布腳本在建立 tag 後，把 `release` 推進到同一個 commit：`git push --follow-tags && git push origin HEAD:release`。`release` 只在發布時移動，所以「推送 `release`」等於「推送 tag」〔推論〕。
- Build command：`bun install --frozen-lockfile && bun run build`，搭配 build 變數 `SKIP_DEPENDENCY_INSTALL=1`、`BUN_VERSION=1.4.2`。
- Deploy command：`bun run db:migrate:remote && bunx wrangler deploy`。
- API token：在自動建立的 token 加上 D1 Edit。
- 先修正第 1.1 節第 2 點的 tag 問題（`bump.config.ts` 用 `execute` 產生 changelog）。

理由：方案 A 只用 Workers Builds 的內建功能。它不需要 GitHub Actions，不需要把 Cloudflare token 或 deploy hook URL 存到 GitHub。其他方案不是依賴查不到的行為（方案 B 的 clone 是否含 tag），就是需要額外的憑證與未驗證的行為（方案 C），或讓未發布的程式碼使用正式的 D1（方案 D）。

方案 A 的弱點：Cloudflare 不知道 tag 存在。任何人把 commit 推到 `release` 都會部署。單一維護者的 repo 可以接受；要更嚴格時，在 GitHub 用 ruleset 禁止刪除 `release` 與 force push（第 11.2 節）。

---

## 2. Tag 觸發與分支控制（問題 1）

### 2.1 Workers Builds 支援的觸發方式

| 項目                         | 內容                                                                                                                                                                                                                                                                            | 標記                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Production branch            | Settings > Build > Branch control 選一個分支。「Every push event made to this branch will trigger a build and execute the build command, followed by the deploy command」                                                                                                       | 〔查證：Build branches〕                                                              |
| Preview builds               | 勾選 **Enable Preview Builds** 後，其他分支的每一次 push 執行 build command 與 Preview command（預設 `npx wrangler preview`）。取消勾選則不建置                                                                                                                                 | 〔查證：Build branches、Configuration〕                                               |
| 分支篩選                     | 一個 Worker 最多兩個 trigger（production 與 preview）。Trigger 有 `branch_includes`、`branch_excludes`，可用萬用字元（例：`["*"]`、`fix/*`）                                                                                                                                    | 〔查證：Builds API reference、Build watch paths「Wildcard syntax」〕                  |
| Build watch paths            | `path_includes`、`path_excludes`。以 push 內變更的檔案判斷；0 個變更、3000 個以上的檔案或 20 個以上的 commit 時，不判斷，直接建置                                                                                                                                               | 〔查證：Build watch paths〕                                                           |
| Tag                          | 文件、trigger 欄位、手動建置 API 都沒有 tag。`build_trigger_source` 的值是 `push`、`pull_request`、`manual`、`api`                                                                                                                                                              | 查不到支援。〔查證：Builds API reference、Start a Workers build、Workers Builds API〕 |
| Deploy Hooks                 | 每個 hook 是一個 URL，綁定**一個分支**。POST 這個 URL 就以該分支建置，不需要 `Authorization` header。每個 Worker 每分鐘 10 次，每個帳號每分鐘 100 次                                                                                                                            | 〔查證：Deploy Hooks〕                                                                |
| 手動建置 API                 | `POST /accounts/{account_id}/builds/triggers/{trigger_uuid}/builds`，body 帶 `branch`、`commit_hash` 或兩者。兩者都帶時，固定建置該 commit。需要 **user** token，權限 Workers Builds Configuration Edit（API 文件寫成 `Workers CI Write`）；account token 會回「Invalid token」 | 〔查證：Builds API reference、Start a Workers build〕                                 |
| 排隊中的舊建置               | 同一個 trigger 有較新的建置排隊時，Workers Builds 跳過較舊的排隊建置                                                                                                                                                                                                            | 〔查證：Changelog 2026-07-24〕                                                        |
| 暫停自動建置                 | 文件只寫兩種做法：中斷連結（Disconnect），或把 deploy command 改成 `npx wrangler versions upload`（只建立 version，不部署）。沒有「暫停 push 觸發」的開關                                                                                                                       | 〔查證：Builds「Disconnecting builds」〕；開關查不到                                  |
| 內建環境變數                 | `CI=true`、`WORKERS_CI=1`、`WORKERS_CI_BUILD_UUID`、`WORKERS_CI_COMMIT_SHA`、`WORKERS_CI_BRANCH`。沒有 tag 的變數                                                                                                                                                               | 〔查證：Configuration「Default variables」〕                                          |
| Clone 深度、clone 是否含 tag | 文件沒有寫                                                                                                                                                                                                                                                                      | 查不到                                                                                |

### 2.2 方案比較

#### 方案 A：專用部署分支 `release`（建議）

做法：

1. 建立 `release` 分支，在 Dashboard 設為 production branch，關閉 preview builds。
2. 發布腳本建立 tag 後執行 `git push origin HEAD:release`。

可行性：只用文件寫明的行為〔查證：Build branches〕。`WORKERS_CI_BRANCH` 的值是 `release`〔推論：Configuration「Default variables」寫它是 push event 的分支名稱〕。

缺點：

- Cloudflare 不檢查 tag。推到 `release` 的任何 commit 都會部署〔推論〕。
- 發布要推兩次（`main` 與 tag 一次，`release` 一次）。第二次失敗時，tag 已在 GitHub，但沒有部署。補救：`git push origin v1.3.0^{commit}:refs/heads/release`〔推論〕。
- `release` 不是 fast-forward 時，`git push` 會被拒絕。這是保護，不是問題：`release` 只能前進到 `main` 上較新的 commit〔推論：git 的預設行為〕。
- GitHub 的 check run 只出現在 `release` 的 commit 上；關閉 preview builds 後，PR 沒有 Cloudflare 的 check run〔推論：GitHub integration「Check run」只對有建置的 commit 產生〕。

Dashboard 設定：Branch control 的 production branch 選 `release`、取消 Enable Preview Builds；Build 的指令與變數見第 4 節；API token 見第 5 節。

#### 方案 B：production branch 用 `main`，在 deploy command 判斷 commit 有沒有 tag

做法：deploy command 改成一段指令，例如：

```sh
if git describe --exact-match --tags --match 'v*' HEAD >/dev/null 2>&1; then
  bun run db:migrate:remote && bunx wrangler deploy
else
  echo "HEAD 沒有 v* tag，不部署"
fi
```

可行性：**不確定。** 它依賴 clone 內有 tag。Workers Builds 的 clone 深度、是否抓 tag，文件沒有寫（查不到）。內建變數也沒有 tag（第 2.1 節）。repo 是公開的，指令可以先執行 `git fetch --tags` 或查 GitHub API 取得 tag〔推論〕，但這也沒有文件保證 build 環境可連到 GitHub。

缺點：

- 每一次推送 `main` 都花一次建置時間〔查證：Build branches〕。
- 先推 commit、後推 tag（兩次 push）時，推 tag 那次不觸發建置，所以不會部署〔推論：tag push 不是分支 push；是否觸發查不到〕。
- 建置顯示成功，但實際沒有部署，容易誤讀〔推論〕。

要採用時，先做一次診斷建置：在 build command 前面加 `git rev-parse --is-shallow-repository; git tag --points-at HEAD`，看建置紀錄的輸出。

#### 方案 C：tag 觸發 GitHub Action，由 Action 呼叫 Deploy Hook 或手動建置 API

做法：`.github/workflows/release.yml` 在 `push: tags: ['v*']` 時執行 `curl`。

- 用 Deploy Hook：hook 綁定分支，建置的是**該分支當下的最新 commit**〔查證：Deploy Hooks「one branch」〕。如果 tag 之後 `main` 又有新的 commit，部署的不是 tag 的 commit〔推論〕。
- 用手動建置 API：帶 `commit_hash`（tag 指向的 commit）與 `branch`，可以固定 commit〔查證：Builds API reference「Redeploy current deployment」〕。

可行性：**有未查證的前提。** 要讓 `main` 的 push 不自動部署，production trigger 就不能接受 `main` 的 push。可選的做法是把 production branch 設成一個沒有人推送的分支，或把 build watch paths 設成不會匹配的路徑。但是手動建置 API 或 Deploy Hook 是否受 trigger 的 `branch_includes` 或 watch paths 限制，文件沒有寫（查不到）。

缺點：

- GitHub 要保存憑證：Deploy Hook URL（本身就是憑證〔查證：Deploy Hooks「Security considerations」〕），或一個有 Workers Builds Configuration Edit 的 **user** token〔查證：Builds API reference〕。
- 加回 GitHub Actions。既然要用 Actions，直接在 Action 裡執行 `wrangler deploy`（`e675c17` 之前的做法）更簡單〔推論〕。這樣就不需要 Workers Builds。

#### 方案 D：`main` 只上傳 version，tag 時另外升級為正式部署

做法：production branch 用 `main`，deploy command 改成 `npx wrangler versions upload`〔查證：Builds「Disconnecting builds」〕。推 tag 時，由本機或 GitHub Action 執行 `wrangler versions deploy <version-id>`。

缺點：

- Workers Builds 無法做「升級」這一步，仍要本機或 Actions 持有 token〔推論〕。
- Version URL 使用正式環境的資源〔查證：Compare workflows「Version URLs use production resources」〕。未發布的程式碼可以讀寫正式的 D1。
- D1 migration 的時間點不對：在上傳時套用，正式環境的舊程式碼就要面對新 schema；在升級時套用，就要另一個有 D1 權限的執行環境〔推論〕。

不建議。

### 2.3 比較表

| 方案                      | 只用內建功能 | GitHub 要存憑證 | 部署的 commit 等於 tag     | 依賴查不到的行為             | 推 `main` 的建置成本 |
| ------------------------- | ------------ | --------------- | -------------------------- | ---------------------------- | -------------------- |
| A `release` 分支          | 是           | 否              | 是，由發布腳本保證〔推論〕 | 否                           | 無                   |
| B deploy command 判斷 tag | 是           | 否              | 是                         | 是（clone 是否含 tag）       | 每次推送一次建置     |
| C Action + Hook/API       | 否           | 是              | Hook：否；API：是          | 是（手動建置是否受篩選限制） | 無                   |
| D versions upload         | 否           | 是              | 是                         | 否                           | 每次推送一次建置     |

---

## 3. Build 映像檔、bun 與變數（問題 2）

| 項目                           | 內容                                                                                             | 標記                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| 作業系統                       | Ubuntu 24.04，x86_64                                                                             | 〔查證：Build image〕                            |
| Node.js                        | 預設 24.18.0；映像檔預裝 22.23.2 與 24.18.0；用 `NODE_VERSION`、`.nvmrc` 或 `.node-version` 覆寫 | 〔查證：Build image、Changelog 2026-07-30〕      |
| Bun                            | 預設 **1.2.15**；用 build 變數 `BUN_VERSION` 覆寫。文件沒有列 `.bun-version` 之類的檔案          | 〔查證：Build image〕                            |
| Bun 的更新政策                 | Bun 不遵循 semver，可能有破壞性變更的更新會提前 3 個月通知；指定版本後不自動更新                 | 〔查證：Build image「Build Image Policy」〕      |
| 依 `bun.lock` 偵測套件管理工具 | Workers Builds 文件沒有寫它用哪個套件管理工具自動安裝相依套件，也沒有寫是否偵測 `bun.lock`       | 查不到                                           |
| 跳過自動安裝                   | build 變數 `SKIP_DEPENDENCY_INSTALL=1`（或 `true`），改在 build command 自己安裝                 | 〔查證：Build image「Skip dependency install」〕 |
| Build cache                    | 支援 bun，快取 `.bun/install/cache`；7 天沒讀取就清除；每個專案 10 GB                            | 〔查證：Build caching〕                          |
| Build 變數與 secret            | Settings > Build > Build variables and secrets。只在建置時可用，Worker 執行時讀不到              | 〔查證：Configuration「Build settings」〕        |
| 執行時的變數與 secret          | Settings > Variables & Secrets，或 `wrangler secret put`。與 build 變數分開                      | 〔查證：Configuration「Build settings」〕        |
| 變數數量                       | 每個 Worker 64 個，每個 5 KB                                                                     | 〔查證：Limits & pricing〕                       |

對本專案：

- 本機是 bun 1.4.2，`bun.lock` 的開頭是 `"lockfileVersion": 1, "configVersion": 1`〔查證：`bun --version`、`bun.lock`〕。bun 1.2.15 是否能以 `--frozen-lockfile` 讀這個檔案，沒有實測〔推論：有不相容的風險〕。建議設 `BUN_VERSION=1.4.2`，與本機一致。
- 因為文件沒有寫自動安裝用哪個工具，建議 `SKIP_DEPENDENCY_INSTALL=1`，在 build command 明確執行 `bun install --frozen-lockfile`〔推論〕。
- Worker 執行時不需要 secret：`src/` 只讀 binding（`DB`、`SUBSCRIPTIONS_KV`），`JWT_SECRET` 存在 D1（見 `docs/research/2026-09-26-kv-vs-d1.md`）〔查證：`grep env\. src`〕。舊 `deploy.yml` 傳的 `--var VERSION` 已不再使用〔查證：`src/` 沒有 `VERSION`〕。

---

## 4. Build command 與 deploy command（問題 3）

### 4.1 預設值與可自訂範圍

| 設定                       | 預設值                         | 自訂範圍                                                               | 標記                                                  |
| -------------------------- | ------------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| Build command              | 空（選填）                     | 任意指令                                                               | 〔查證：Configuration〕                               |
| Deploy command             | `npx wrangler deploy`          | 任意指令；可用 `package.json` 的腳本，例如 `npm run deploy`            | 〔查證：Configuration「Deploy command」〕             |
| Preview command            | `npx wrangler preview`         | 自訂指令必須呼叫 `npx wrangler preview`（切換到 Worker Previews 之後） | 〔查證：Configuration、Build branches〕               |
| Root directory             | repo 根目錄                    | 子目錄（monorepo 用）                                                  | 〔查證：Configuration〕                               |
| Wrangler 版本              | 使用 `package.json` 指定的版本 | —                                                                      | 〔查證：Configuration〕                               |
| `[build]`（Custom Builds） | Workers Builds 不讀取          | —                                                                      | 〔查證：Configuration「Note」〕；本專案沒有 `[build]` |
| 建置逾時                   | 20 分鐘                        | —                                                                      | 〔查證：Limits & pricing〕                            |

設定變更只套用到**下一次**建置；Retry 使用 retry 當下的設定〔查證：Configuration〕。

### 4.2 搭配 `@cloudflare/vite-plugin`

- Vite plugin 文件的做法：先 `vite build`，再 `wrangler deploy`；`wrangler deploy` 自動使用建置輸出的 `wrangler.json`〔查證：Vite plugin Tutorial「Deploy to Cloudflare」〕。Cloudflare 環境在建置時決定，`wrangler deploy` 時設定 `CLOUDFLARE_ENV` 沒有效果〔查證：Vite plugin「Cloudflare Environments」〕。
- Workers Builds 文件沒有 Vite plugin 專用的設定。本專案的對應是：build command 執行 `bun run build`（`vite build`），deploy command 執行 `wrangler deploy`〔推論〕。
- 實測輸出〔實測：`bun run build`，wrangler 4.141.0〕：
  - `.wrangler/deploy/config.json`：`{"configPath":"../../dist/subs_tracker/wrangler.json","auxiliaryWorkers":[]}`。目錄名稱是 `subs_tracker`（底線）。
  - `dist/subs_tracker/wrangler.json`：`"name":"subs-tracker"`、`"triggers":{"crons":["0 * * * *"]}`、`"d1_databases":[{"binding":"DB","database_name":"subs-tracker","migrations_dir":"../../migrations"}]`、KV binding 保留原本的 `id`。
  - `wrangler deploy --dry-run` 顯示「Using redirected Wrangler configuration」，binding 為 `env.SUBSCRIPTIONS_KV (3129bff9…)` 與 `env.DB (subs-tracker)`，沒有連線 API。
  - `wrangler d1 migrations apply DB --local` 在有與沒有 `dist/` 時都找到 `migrations/0001_init.sql`。所以 migration 指令可以在建置前或建置後執行。

### 4.3 建議值

| 欄位                     | 值                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Git branch（production） | `release`                                                                             |
| Enable Preview Builds    | 關閉                                                                                  |
| Build command            | `bun install --frozen-lockfile && bun run build`                                      |
| Deploy command           | `bun run db:migrate:remote && bunx wrangler deploy`                                   |
| Root directory           | 空（repo 根目錄）                                                                     |
| Build variables          | `BUN_VERSION=1.4.2`、`SKIP_DEPENDENCY_INSTALL=1`                                      |
| Build cache              | 可開啟（bun 快取）；本專案 `vite build` 本機約 0.2 秒〔實測〕，收益主要在安裝相依套件 |

不直接用 `bun run deploy` 當 deploy command：這個腳本會再建置一次〔查證：`package.json`〕。

---

## 5. D1 migration 與 API token（問題 4）

| 項目                                 | 內容                                                                                                                                                                                                  | 標記                                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 自動建立的 token 權限                | Account Settings (read)、Workers Scripts (edit)、Workers KV Storage (edit)、Workers R2 Storage (edit)、Zone Workers Routes (edit)、User Details (read)、Memberships (read)。**沒有 D1**               | 〔查證：Configuration「API token」〕                                                                                                         |
| Token 類型                           | 目前只支援 user token                                                                                                                                                                                 | 〔查證：Configuration「API token」〕                                                                                                         |
| 修改權限                             | 到 **My Profile > API Tokens** 修改這個 token                                                                                                                                                         | 〔查證：Configuration「API token」〕                                                                                                         |
| D1 權限名稱                          | `D1 Read`、`D1 Edit`                                                                                                                                                                                  | 〔查證：API token permissions〕                                                                                                              |
| `migrations apply --remote` 找資料庫 | config 沒有 `database_id` 時，以 `database_name` 呼叫 `GET /accounts/{id}/d1/database/{name}`；404 時錯誤訊息是「Couldn't find a D1 DB named 'subs-tracker' … Run 'wrangler d1 create subs-tracker'」 | 〔查證：wrangler 原始碼 `getDatabaseByNameOrBinding`（`src/d1/utils.ts`，`cli.js` 約第 229965 行）〕                                         |
| CI 中的確認提示                      | `migrations apply` 會詢問是否繼續；非互動環境使用 fallback 值 `yes`                                                                                                                                   | 〔查證：wrangler 原始碼 `confirm2`，`fallbackValue = true`〕〔實測：`CI=true` 輸出「Using fallback value in non-interactive context: yes」〕 |
| Migration 與部署的順序               | 先 migration，後部署。新的 schema 在新程式碼上線前生效，所以 migration 必須與舊程式碼相容。`AGENTS.md` 已規定 migration 只新增                                                                        | 〔推論〕、〔查證：`AGENTS.md`〕                                                                                                              |

結論：deploy command 可以執行 `wrangler d1 migrations apply DB --remote`，但 token 必須有 D1 Edit。沒有 D1 Edit 時，migration 在找資料庫這一步就收到 403 而失敗〔推論：API 權限〕。`&&` 讓 migration 失敗時不執行 `wrangler deploy`。

處理方式（二選一）：

1. 在 My Profile > API Tokens 編輯 Workers Builds 自動建立的 token，加上 Account > D1 > Edit。
2. 自己建立一個 user token（自動建立的權限 + D1 Edit），在 Settings > Builds > API token 選它。文件建議所有上傳與部署都用同一個 token〔查證：Configuration「API token」〕。

Token 被刪除或 roll 之後，建置失敗並顯示「The build token selected for this build has been deleted or rolled」〔查證：Troubleshooting builds「Stale API token」〕。

---

## 6. 沒有 `database_id` 時 `wrangler deploy` 的行為（問題 5）

### 6.1 自動佈建

- 自 wrangler 4.45.0 起，config 中不存在的 KV、D1、R2 資源會在 `wrangler deploy` 時自動建立並連結；之後即使 config 沒有 ID，部署仍連到同一個資源；用 `--no-x-provision` 關閉〔查證：Changelog 2025-10-24〕。
- wrangler 4.141.0 中，`--x-provision` 與 `--x-auto-create` 的預設都是 `true`〔查證：wrangler 原始碼，`cli.js` 約第 359605 行〕。

### 6.2 D1 binding 的判斷順序

依 wrangler 4.141.0 的 `provisionBindings` 與 `D1Handler`（`deploy-helpers/src/deploy/helpers/provision-bindings.ts`，`cli.js` 約第 169709、170130、170513 行）〔查證：wrangler 原始碼〕：

1. 有 `database_id`：不處理。
2. 讀取已部署 Worker 的 settings。已有名為 `DB` 的 D1 binding，且那個資料庫的名稱等於 `database_name`：沿用（inherit）。
3. 否則以 `database_name` 查 D1 API。找到：連到它。
4. 否則建立資料庫：有 `database_name` 就用這個名稱（`subs-tracker`），在 CI 中不詢問。
5. 任一步收到 403（沒有權限）：沒有 ID 時沿用已部署的 binding，並警告「Skipping automatic provisioning … because Wrangler does not have permission」，部署繼續。
6. 非互動或 CI 環境中，wrangler 不把 ID 寫回 config 檔。

### 6.3 對 Workers Builds 的意義

- 只要 token 有 D1 Edit，而且帳號內有名為 `subs-tracker` 的資料庫，`wrangler deploy` 會連到它，不需要在 repo 寫 `database_id`〔推論：6.2 第 2、3 步〕。
- 風險在第 4 步：資料庫名稱不同或不存在時，部署會建立一個**空的**資料庫並連上〔推論〕。Deploy command 先執行 `migrations apply`，資料庫不存在時 migration 先失敗，`wrangler deploy` 不執行〔查證：wrangler 原始碼 404 錯誤〕〔推論：`&&`〕。
- 更嚴格的做法：在 `wrangler deploy` 加 `--no-x-provision`，禁止自動佈建〔查證：Changelog 2025-10-24〕。這時第 2、3 步是否仍執行，原始碼沒有細看，未實測（第 12 節）。
- 在 repo 寫入 `database_id` 也可行，但 ID 屬於作者的帳號。`wrangler.toml` 已含作者帳號的 KV `id`，所以這不是新問題〔查證：`wrangler.toml`〕。本文不建議寫入：名稱查詢已經足夠，而且自架者不用改檔案〔推論〕。

---

## 7. Worker 名稱與連結既有 Worker（問題 6）

| 項目            | 內容                                                                                                                                                                                           | 標記                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 規則            | Dashboard 的 Worker 名稱必須等於 root directory 中 Wrangler 設定檔的 `name`，否則建置失敗：「The name in your Wrangler configuration file (<Worker name>) must match the name of your Worker」 | 〔查證：Builds「Caution」、Troubleshooting builds〕 |
| Wrangler 環境   | `[env.X]` 的 Worker（`<name>-<env>`）可連結；Workers Builds 以 `WRANGLER_CI_OVERRIDE_NAME` 覆寫名稱                                                                                            | 〔查證：Troubleshooting builds〕                    |
| 連結既有 Worker | Workers & Pages > 選 Worker > Settings > Builds > Connect，依提示選 repo 與設定建置；之後推送 commit 觸發建置                                                                                  | 〔查證：Builds「Connect an existing Worker」〕      |
| 換 repo         | 先 Disconnect，再重新連結                                                                                                                                                                      | 〔查證：Builds「Disconnecting builds」〕            |
| GitHub App      | 「Cloudflare Workers and Pages」App；建議只授權需要的 repo；一個 GitHub 帳號只對應一個 Cloudflare 帳號                                                                                         | 〔查證：GitHub integration〕                        |

本專案的情況：

- 本分支的 `wrangler.toml`：`name = "subs-tracker"`，沒有 `[env.*]`。Vite 建置輸出也是 `"name":"subs-tracker"`〔實測〕。
- `main` 上的舊設定：`[env.production] name = "subscription-manager"`、`[env.staging] name = "subscription-manager-staging"`〔查證：`git show origin/main:wrangler.toml`〕。舊 `deploy.yml` 在 push `main` 時執行 `deploy --env production`〔查證：`git show e675c17^:.github/workflows/deploy.yml`〕。所以 GitHub Actions 時期的正式 Worker 可能是 `subscription-manager`〔推論〕。之後是否手動部署過 `subs-tracker`，本研究無法確認（沒有連線 Cloudflare）。

兩種處理：

1. 正式 Worker 是 `subs-tracker`：直接連結它。
2. 正式 Worker 是 `subscription-manager`：
   - 連結或建立 `subs-tracker`，把自訂網域或 route 移過去。KV binding 的 `id` 相同，第一次讀取時匯入舊資料〔查證：`AGENTS.md`「Legacy import」〕。
   - 或把 `wrangler.toml` 的 `name` 改成 `subscription-manager`。這會改變自架者的預設 Worker 名稱〔推論〕。

---

## 8. 回滾、版本與 PR 預覽（問題 7）

### 8.1 回滾

| 項目                  | 內容                                                                                                              | 標記                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Production 建置的產物 | 每次 production 建置建立一個 version；deploy command 是 `wrangler deploy` 時，這個 version 成為 active deployment | 〔查證：Builds「View build and Preview URL」〕                        |
| 回滾方式              | `wrangler rollback [version-id]`，或 Dashboard > Deployments > 版本的選單 > Rollback                              | 〔查證：Rollbacks〕                                                   |
| 範圍                  | 最近 100 個 version                                                                                               | 〔查證：Rollbacks「Limits」〕                                         |
| 資源                  | 回滾不改變 binding 的資源；資料結構已改變時，舊程式碼可能出錯                                                     | 〔查證：Rollbacks「Caution」〕                                        |
| 重新建置某個 commit   | 手動建置 API 帶 `branch` 與 `commit_hash`；或 Dashboard 的 Retry build（使用目前的設定）                          | 〔查證：Builds API reference、Troubleshooting builds、Configuration〕 |

對本專案：

- 回滾只回復程式碼。D1 migration 不會回復〔查證：Rollbacks「Caution」〕。migration 只新增欄位或表時，舊程式碼仍可執行〔推論〕。資料要回到某個時間點，用 D1 Time Travel（見 `docs/research/2026-09-26-kv-vs-d1.md`）。
- 不要用「把 `release` force push 到舊 tag」回滾：它會再執行一次 migration 指令（已套用的 migration 會被略過）與建置，比 `wrangler rollback` 慢，而且改寫 `release` 的歷史〔推論〕。

### 8.2 PR 預覽建置：不建議開啟

- 2026-09-22 起，新的 Workers Builds 專案以 Worker Previews 執行 preview build（`npx wrangler preview`）〔查證：Changelog 2026-09-22、Build branches〕。
- Previews **不繼承**正式環境的設定，要在 `wrangler.toml` 加 `previews` 區塊（可為空），binding 與變數要另外宣告〔查證：Previews Configuration〕。沒有宣告 `previews.d1_databases` 時，Preview 沒有 `DB`，本 app 無法運作〔推論〕。
- D1 的隔離要另一個資料庫：`previews.d1_databases` 指向 staging 資料庫，再用另一個設定檔（例如 `wrangler.preview-migrations.jsonc`）套用 migration〔查證：Previews Resources「D1 migrations」〕。
- Cron Trigger 只對正式環境執行，不呼叫 Preview 的 `scheduled()`〔查證：Previews Resources「Cron Triggers」〕。本 app 的主要流程是排程提醒。
- 把 Preview command 改成 `wrangler versions upload` 會產生 Version URL，但 Version URL 使用正式環境的資源〔查證：Compare workflows〕，會讓未合併的程式碼讀寫正式的 D1。
- 既有 Worker 切換到 Worker Previews 後不能切回〔查證：Build branches「The switch cannot be reversed」〕。

單一使用者的 app，現在用 `bun run dev` 與 `bun run preview` 在本機驗證（`AGENTS.md`）。開啟 PR 預覽要多一個 D1 資料庫、一個設定檔、一套 Preview secret，收益低〔推論〕。

---

## 9. 費用與額度（問題 8）

| 項目              | Free                                            | Paid                            | 標記                       |
| ----------------- | ----------------------------------------------- | ------------------------------- | -------------------------- |
| 建置分鐘數        | 每月 3,000                                      | 每月 6,000，超過每分鐘 US$0.005 | 〔查證：Limits & pricing〕 |
| 同時建置數        | 1（整個帳號）                                   | 6                               | 〔查證：Limits & pricing〕 |
| 建置逾時          | 20 分鐘                                         | 20 分鐘                         | 〔查證：Limits & pricing〕 |
| CPU／記憶體／磁碟 | 2 vCPU／8 GB／20 GB                             | 4 vCPU／8 GB／20 GB             | 〔查證：Limits & pricing〕 |
| Deploy Hooks      | 每個 Worker 每分鐘 10 次、每個帳號每分鐘 100 次 | 同左                            | 〔查證：Limits & pricing〕 |

方案 A 只在發布時建置。每次建置包含 `bun install`、`vite build`（本機約 0.2 秒〔實測〕）、migration、上傳。估計每次在幾分鐘內，遠低於免費額度〔推論：沒有在 Workers Builds 實測〕。Free 方案整個帳號同時只能 1 個建置，帳號內其他 Worker 的建置會讓發布排隊〔推論〕。

---

## 10. 發布腳本的 tag 問題

### 10.1 現況

- `package.json`：`"release": "bumpp && bun run changelog && git add CHANGELOG.md && git commit --amend --no-edit && git push --follow-tags"`〔查證：`package.json`〕。
- `bump.config.ts`：`tag: true`、`push: false`、`all: false`〔查證：`bump.config.ts`〕。
- bumpp 12.3.0 以 `git tag --annotate --message <commit message> <tag>` 建立 tag；`all: false` 時，`git commit` 只帶 bumpp 修改過的檔案路徑〔查證：`node_modules/bumpp/dist/config-CadB_BQ2.mjs` 的 `gitCommit`、`gitTag`〕。

### 10.2 實測

在暫時的 repo 中照相同順序執行（commit → annotated tag → 修改 `CHANGELOG.md` → `git commit --amend --no-edit` → `git push --follow-tags`）〔實測〕：

```
HEAD=17c9b11 tag->cccdac8
17c9b11…  refs/heads/main      # remote 只有 main，沒有 v1.3.0
```

amend 之後 tag 指向舊 commit；`--follow-tags` 只推送「被推送的 ref 可到達」的 annotated tag，所以 tag 沒有推送。

### 10.3 修正

改用 bumpp 的 `execute` 選項（「Execute additional command after bumping and before committing」〔查證：`node_modules/bumpp/dist/index.d.mts`〕），在 commit 前產生 changelog，並用 `all: true` 讓 commit 包含 `CHANGELOG.md`：

```ts
export default defineConfig({
  files: ['package.json'],
  commit: 'chore(release): bump version to v%s',
  tag: true,
  push: false,
  all: true,
  execute: 'bun run changelog',
})
```

```json
"release": "bumpp && git push --follow-tags && git push origin HEAD:release",
"release:minor": "bumpp minor && git push --follow-tags && git push origin HEAD:release",
"release:major": "bumpp major && git push --follow-tags && git push origin HEAD:release",
```

實測（暫時的 repo，bumpp 12.3.0、同一份 `conventional-changelog`）〔實測〕：

```
8400750 (HEAD -> main, tag: v1.3.0) chore(release): bump version to v1.3.0
 CHANGELOG.md | 6 ++++++
 package.json | 2 +-
refs/tags/v1.3.0^{}  8400750…   # remote 的 tag 指向 main 的 HEAD
```

注意：`all: true` 會執行 `git add --all`，未追蹤的檔案也會被 commit〔查證：bumpp 原始碼〕。在乾淨的工作目錄執行發布。

---

## 11. 遷移步驟

### 11.1 repo 內要改的檔案

| 順序 | 檔案                              | 修改                                                                                                                                                                                                           |
| ---- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `bump.config.ts`                  | `all: true`、`execute: 'bun run changelog'`（第 10.3 節）                                                                                                                                                      |
| 2    | `package.json`                    | `release`、`release:minor`、`release:major` 改為 `bumpp [minor\|major] && git push --follow-tags && git push origin HEAD:release`，刪除 changelog 與 amend 步驟。`deploy` 腳本保留，作為手動部署與自架者的路徑 |
| 3    | `AGENTS.md`                       | 「Commands」的 `bun run deploy` 與「Commit Messages」的 release 說明：正式部署由 Workers Builds 在 `release` 更新時執行；`release` 只由發布腳本推進                                                            |
| 4    | `AGENTS.md`「Cloudflare Workers」 | 加一段 Workers Builds：production branch `release`、build 與 deploy command、token 需要 D1 Edit、preview builds 關閉                                                                                           |
| 5    | `README.md`（選擇性）             | 自架者可選「Workers Builds」路徑：先 `wrangler d1 create subs-tracker`，再連結 repo                                                                                                                            |

不需要新增 `.github/workflows/`，也不需要修改 `wrangler.toml`。

### 11.2 使用者在 Cloudflare Dashboard 與 GitHub 的操作

| 順序 | 位置                                   | 操作                                                                                                                               |
| ---- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Dashboard > Workers & Pages            | 確認正式環境的 Worker 名稱（`subs-tracker` 或 `subscription-manager`），依第 7 節決定                                              |
| 2    | Dashboard > Storage & Databases > D1   | 確認帳號內有名為 `subs-tracker` 的資料庫；沒有時先在本機執行 `bunx wrangler d1 create subs-tracker`，不加 `--update-config` 也可以 |
| 3    | GitHub                                 | 在 11.1 的修改合併後，建立 `release` 分支並推送：`git push origin main:release`                                                    |
| 4    | GitHub（選擇性）                       | 為 `release` 建 ruleset：禁止刪除、禁止 force push（non-fast-forward）                                                             |
| 5    | Dashboard > Worker > Settings > Builds | Connect，選 GitHub 帳號與 `gn00678465/subs-tracker`；GitHub App 只授權這個 repo                                                    |
| 6    | 同上 > Branch control                  | Production branch 選 `release`；取消 Enable Preview Builds                                                                         |
| 7    | 同上 > Build configuration             | Build command、deploy command、root directory 依第 4.3 節                                                                          |
| 8    | 同上 > Build variables and secrets     | `BUN_VERSION=1.4.2`、`SKIP_DEPENDENCY_INSTALL=1`                                                                                   |
| 9    | My Profile > API Tokens                | 找到 Workers Builds 自動建立的 token，加上 Account > D1 > Edit；或建立新的 user token，在 Settings > Builds > API token 選它       |
| 10   | 本機                                   | 執行 `bun run release`，在 Deployments > View build history 看建置紀錄。確認 migration 步驟與 `wrangler deploy` 都成功             |
| 11   | Dashboard > Worker > Deployments       | 確認 active deployment 是這次建置的 version；確認 Cron Trigger 仍是 `0 * * * *`                                                    |

回復方式：Settings > Builds > Disconnect，回到手動 `bun run deploy`〔查證：Builds「Disconnecting builds」〕。

---

## 12. 未解問題

1. **正式環境的 Worker 名稱**：`subs-tracker` 或 `subscription-manager`。要在 Dashboard 確認（第 7 節）。
2. **Tag push 是否觸發任何建置**：文件沒有寫。方案 A 不依賴這一點；方案 B 依賴。
3. **Clone 深度與 clone 是否含 tag**：查不到。方案 B 採用前要做一次診斷建置（第 2.2 節）。
4. **自動安裝相依套件時的套件管理工具**：Workers Builds 文件沒有寫是否偵測 `bun.lock`。本文以 `SKIP_DEPENDENCY_INSTALL=1` 避開。
5. **bun 1.2.15 能否讀 `configVersion: 1` 的 `bun.lock`**：未實測。本文以 `BUN_VERSION=1.4.2` 避開。
6. **手動建置 API 與 Deploy Hook 是否受 trigger 的分支與路徑篩選限制**：查不到。只影響方案 C。
7. **`--no-x-provision` 時是否仍沿用已部署的 binding 或依名稱連結**：原始碼沒有細看，未實測。
8. **Workers Builds 實際的建置時間**：沒有在 Workers Builds 上執行過。第 9 節的估計是推論。

---

## 13. 來源

### Cloudflare 文件（2026-09-26 下載）

- Builds：https://developers.cloudflare.com/workers/ci-cd/builds/
- Configuration：https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- Build branches：https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
- Build watch paths：https://developers.cloudflare.com/workers/ci-cd/builds/build-watch-paths/
- Build image：https://developers.cloudflare.com/workers/ci-cd/builds/build-image/
- Build caching：https://developers.cloudflare.com/workers/ci-cd/builds/build-caching/
- Deploy Hooks：https://developers.cloudflare.com/workers/ci-cd/builds/deploy-hooks/
- Builds API reference：https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/
- Limits & pricing：https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/
- Troubleshooting builds：https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/
- Advanced setups：https://developers.cloudflare.com/workers/ci-cd/builds/advanced-setups/
- GitHub integration：https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/
- Previews Configuration：https://developers.cloudflare.com/workers/previews/configuration/
- Previews Resources and isolation：https://developers.cloudflare.com/workers/previews/resources/
- Compare workflows：https://developers.cloudflare.com/workers/previews/compare-workflows/
- Rollbacks：https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- Vite plugin Cloudflare Environments：https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/
- Vite plugin Tutorial：https://developers.cloudflare.com/workers/vite-plugin/tutorial/
- API token permissions：https://developers.cloudflare.com/fundamentals/api/reference/permissions/

### Cloudflare API 文件

- Start a Workers build：https://developers.cloudflare.com/api/resources/workers_builds/subresources/triggers/methods/create_build/
- Create a build trigger：https://developers.cloudflare.com/api/resources/workers_builds/subresources/triggers/methods/create/
- Workers Builds（`build_trigger_source`）：https://developers.cloudflare.com/api/resources/workers_builds/

### Cloudflare changelog

- 2025-10-24 Automatic resource provisioning for KV, R2, and D1：https://developers.cloudflare.com/changelog/post/2025-10-24-automatic-resource-provisioning/
- 2026-07-24 Workers Builds now skips superseded queued builds：https://developers.cloudflare.com/changelog/post/2026-07-24-skip-superseded-builds/
- 2026-07-30 Node.js 24 is now the default for Workers Builds：https://developers.cloudflare.com/changelog/post/2026-07-30-workers-builds-nodejs-24/
- 2026-09-22 Worker Previews：https://developers.cloudflare.com/changelog/post/2026-09-22-worker-previews/

### 原始碼

- wrangler 4.141.0（`node_modules/wrangler/wrangler-dist/cli.js`）：`provisionBindings`、`ProvisionResourceHandler.shouldProvision`、`D1Handler`（來源 `deploy-helpers/src/deploy/helpers/provision-bindings.ts`）；`getDatabaseByNameOrBinding`（`src/d1/utils.ts`）；`confirm2`；`experimental-provision`、`experimental-auto-create` 的預設值
- bumpp 12.3.0（`node_modules/bumpp/dist/config-CadB_BQ2.mjs`、`dist/index.d.mts`）：`gitCommit`、`gitTag`、`execute`

### 本 repo

- `wrangler.toml`、`package.json`、`bump.config.ts`、`bun.lock`、`AGENTS.md`、`README.md`
- `git show origin/main:wrangler.toml`、`git show e675c17^:.github/workflows/deploy.yml`、`git ls-remote --tags origin`

### 實測（scratchpad）

- 專案複本：`bun run build`、`.wrangler/deploy/config.json` 與 `dist/subs_tracker/wrangler.json` 的內容、`wrangler deploy --dry-run`、`CI=true wrangler d1 migrations apply DB --local`、有與沒有 `dist/` 時的 `wrangler d1 migrations list DB --local`
- 暫時的 git repo：現行 release 流程（tag 後 amend）與 `bumpp minor --yes`（`all: true`、`execute`）的 tag 推送結果
