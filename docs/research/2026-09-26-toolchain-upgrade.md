# 工具鏈升級研究：Hono、Vite / Vite+、oxlint、oxfmt

- 查核日期：2026-09-26
- 範圍：`package.json` 內全部套件、Hono 升級、Vite → Vite+、ESLint → oxlint、格式化工具 → oxfmt。部署目標維持 Cloudflare Workers。
- 名稱確認：
  - 需求中的「omxlint」與「omxfmt」不存在於 npm registry（`npm view omxlint`、`npm view omxfmt` 皆回傳 `E404`）。GitHub 上有一個 `scentjam8/omxfmt` repo，但它是空的 repo（0 star、沒有主要語言），與格式化工具無關。本文研究的是 OXC 專案的 **`oxlint`** 與 **`oxfmt`**。
  - 「Vite Plus」指 VoidZero 的 **Vite+**，npm 套件名稱是 **`vite-plus`**，CLI 指令是 `vp`。
- 驗證方法：除了閱讀文件，本研究在 scratchpad 目錄（專案之外）複製專案，實際安裝新版本並執行 `tsc`、`vite build`、`vite preview`、`vite dev`、`oxfmt`、`oxlint`、`@oxlint/migrate`、`vp migrate`。本 repo 的 `package.json`、`bun.lock`、`node_modules` 都沒有變更。下文標示「實測」的結果都來自這些複本。

---

## 1. 摘要與建議

### 1.1 最重要的發現

1. **升級 `@hono/zod-openapi` 到 1.6.3 以後，用表單格式呼叫 `POST /api/login` 會回傳 415。** 登入路由只宣告 `application/json`，但程式碼也接受 `application/x-www-form-urlencoded` 與 `multipart/form-data`（`src/routes/auth.ts:49-130`）。實測：目前版本回傳 401（帳密錯誤），升級後回傳 `415 Unsupported Media Type`。修正方法：在 `createRoute` 的 `request.body.content` 補上兩種表單 media type。
2. **專案的「不使用 `any`」規則目前沒有被 ESLint 強制。** `@antfu/eslint-config` 把 `ts/no-explicit-any` 設為 `off`（`node_modules/@antfu/eslint-config/dist/index.mjs:1987`）。`src/` 內有 18 處 `any`，分布在 10 個檔案。oxlint 有原生規則 `typescript/no-explicit-any`，可以強制這條規則。
3. **`typescript` 不是直接相依套件。** `tsc` 來自 `@typescript-eslint/*` 的 peer 相依（`bun.lock:386-402`、`bun.lock:1084`）。移除 ESLint 時，`typescript` 也會一起消失，`bun run typecheck` 會失敗。移除 ESLint 之前，必須先把 `typescript` 加入 `devDependencies`。
4. **Vite+ 目前是 `1.0.0-rc.0`（2026-09-22 發布），授權為 MIT。** 實測可以搭配 bun、`@cloudflare/vite-plugin`、`vite-ssr-components`、`@tailwindcss/vite` 執行 `vp dev`、`vp build`、`vp preview`。但 Vite+ 的 issue tracker 仍有一個與 `@cloudflare/vite-plugin` 有關的開放 issue（dev server 重啟時卡住，#2481）。`vp migrate` 產生的 lint 設定檔也有錯誤，無法直接執行。
5. **換成 oxfmt 會產生大量格式差異。** oxfmt 沒有 brace style 與 member delimiter 選項。實測在最接近目前風格的設定下，`src/` 的 58 個檔案中有 46–48 個檔案變更（約 900–1,100 行新增、約 1,000–1,200 行刪除）。`src/style.css` 格式化後，建置出的 CSS 與原本逐位元組相同。

### 1.2 建議做法

建議分兩個階段：

- **階段一（現在做）**：升級到一般的 Vite 8，並直接使用獨立的 `oxlint` 與 `oxfmt` 取代 ESLint。
- **階段二（Vite+ 1.0 正式版發布後再評估）**：用 `vp migrate` 把 `.oxlintrc.json` 與 `.oxfmtrc.json` 併入 `vite.config.ts`。

理由：

- `vite-plus@1.0.0-rc.0` 綁定的版本是 `oxlint` 1.85.0 與 `oxfmt` 0.70.0（見 `vite-plus` 的 `package.json`），與獨立套件的最新版本相同。先用獨立套件，之後轉移到 Vite+ 時不需要改規則。
- 一般的 Vite 8 升級已經實測可以通過 `tsc`、建置與預覽。`@cloudflare/vite-plugin` 從 1.29.0 起正式把 Vite 8 列入 peer 範圍。
- Vite+ 在 1.0 之前仍有相容性修正。它的 troubleshooting 文件在 rc.0 版本中仍寫著「Vite+ is in beta」。

### 1.3 版本與動作總表

| 套件 | 目前版本（已安裝） | 目標版本 | 動作 | 風險 |
| --- | --- | --- | --- | --- |
| `hono` | 4.11.0 | 4.13.9 | 升級（含多項安全修正） | 低 |
| `@hono/zod-openapi` | 1.1.5 | 1.6.3 | 升級，並修正登入路由的 media type | **中**（415 與錯誤回應格式改變） |
| `@hono/zod-validator` | 0.7.5 | 0.9.1 | 升級（需要 `hono >=4.11.2`） | 低 |
| `@hono/swagger-ui` | 0.5.2 | 0.6.1 | 升級 | 低 |
| `vite` | 6.4.1 | 8.3.1 | 升級兩個 major | 中 |
| `@cloudflare/vite-plugin` | 1.17.1 | 1.60.2 | 升級（Vite 8 需要 ≥1.29.0） | 中 |
| `wrangler` | 4.54.0 | 4.141.0 | 與 Vite plugin 一起升級（peer `^4.141.0`） | 低 |
| `vite-ssr-components` | 0.5.1 | 0.8.0 | 升級（Vite 8 需要 ≥0.5.2） | 低 |
| `tailwindcss` / `@tailwindcss/vite` | 4.1.18 | 4.3.3 | 升級 | 低 |
| `daisyui` | 5.5.14 | 5.7.46 | 升級 | 低 |
| `zod` | 4.1.13 | 4.6.5 | 升級 | 低 |
| `date-fns` | 4.1.0 | 4.4.0 | 升級 | 低 |
| `resend` | 6.6.0 | 6.30.0 | 升級 | 低 |
| `@simplewebauthn/browser` / `server` | 13.2.2 | 14.0.0 / 14.0.3 | 獨立步驟升級，修正型別 import | **中**（型別被移除、執行環境支援不明） |
| `lucide` | 0.562.0 | 1.48.0 | 獨立步驟升級，檢查圖示外觀 | 中 |
| `@cloudflare/workers-types` | 4.20251213.0 | 5.20260926.1 | 升級並改 `tsconfig.json` 的 `types` | 中 |
| `typescript` | 5.9.3（間接安裝） | 明確加入 `devDependencies` | 新增 | **高**（不先做會讓 `typecheck` 失敗） |
| `eslint` | 9.39.2 | — | 移除，改用 `oxlint` | 中 |
| `@antfu/eslint-config` | 6.6.1 | — | 移除 | 中 |
| `oxlint` | — | 1.85.0 | 新增 | 中 |
| `oxlint-tsgolint` | — | 7.0.2003 | 選用，用於 type-aware 規則 | 中 |
| `oxfmt` | — | 0.70.0 | 新增 | 中（大量格式差異） |
| `@types/psl` | 1.1.3 | — | 移除（已棄用的 stub，`psl` 自帶型別） | 低 |
| `conventional-changelog-cli` | 5.0.0 | `conventional-changelog` 8.1.3 | 替換（原套件已棄用） | 低 |
| `bumpp` | 10.3.2 | 12.3.0 | 升級 | 低 |
| `simple-git-hooks` | 2.13.1 | 2.14.0 | 升級並修正 hook 設定漂移 | 低 |
| `@types/bun` | 1.3.4 | 1.4.2 | 升級 | 低 |
| `vite-plus` | — | 1.0.0-rc.0 | 暫不採用，1.0 正式版後再評估 | 中 |

---

## 2. 套件清單（問題 1）

### 2.1 版本對照

最新版本與發布日期來自 `npm view <pkg> version time`（2026-09-26 查詢）。已安裝版本來自 `node_modules/<pkg>/package.json`。

| 套件 | `package.json` 範圍 | 已安裝 | 最新 | 最新版發布日 | 跨 major |
| --- | --- | --- | --- | --- | --- |
| `@hono/swagger-ui` | ^0.5.2 | 0.5.2 | 0.6.1 | 2026-03-11 | 0.x minor（`^0.5.2` 不會自動升級） |
| `@hono/zod-openapi` | ^1.1.5 | 1.1.5 | 1.6.3 | 2026-09-04 | 否 |
| `@hono/zod-validator` | ^0.7.5 | 0.7.5 | 0.9.1 | 2026-08-31 | 0.x minor |
| `@simplewebauthn/browser` | ^13.2.2 | 13.2.2 | 14.0.0 | 2026-09-02 | **是** |
| `@simplewebauthn/server` | ^13.2.2 | 13.2.2 | 14.0.3 | 2026-09-25 | **是** |
| `@tailwindcss/vite` | ^4.1.18 | 4.1.18 | 4.3.3 | 2026-07-16 | 否 |
| `date-fns` | ^4.1.0 | 4.1.0 | 4.4.0 | 2026-05-29 | 否 |
| `hono` | ^4.11.0 | 4.11.0 | 4.13.9 | 2026-09-24 | 否 |
| `lucide` | ^0.562.0 | 0.562.0 | 1.48.0 | 2026-09-24 | **是** |
| `psl` | ^1.15.0 | 1.15.0 | 1.15.0 | 2024-12-02 | 否 |
| `resend` | ^6.6.0 | 6.6.0 | 6.30.0 | 2026-09-25 | 否 |
| `tailwindcss` | ^4.1.18 | 4.1.18 | 4.3.3 | 2026-07-16 | 否 |
| `zod` | ^4.1.13 | 4.1.13 | 4.6.5 | 2026-09-13 | 否 |
| `@antfu/eslint-config` | ^6.6.1 | 6.6.1 | 9.5.1 | 2026-09-02 | **是** |
| `@cloudflare/vite-plugin` | ^1.2.3 | 1.17.1 | 1.60.2 | 2026-09-25 | 否 |
| `@cloudflare/workers-types` | ^4.20251213.0 | 4.20251213.0 | 5.20260926.1 | 2026-09-26 | **是** |
| `@types/bun` | ^1.3.4 | 1.3.4 | 1.4.2 | 2026-09-08 | 否 |
| `bumpp` | ^10.3.2 | 10.3.2 | 12.3.0 | 2026-09-03 | **是** |
| `conventional-changelog-cli` | ^5.0.0 | 5.0.0 | 5.0.0（已棄用） | 2024-05-03 | — |
| `daisyui` | ^5.5.14 | 5.5.14 | 5.7.46 | 2026-09-24 | 否 |
| `eslint` | ^9.39.2 | 9.39.2 | 10.11.0 | 2026-09-18 | **是** |
| `simple-git-hooks` | ^2.13.1 | 2.13.1 | 2.14.0 | 2026-08-28 | 否 |
| `vite` | ^6.3.5 | 6.4.1 | 8.3.1 | 2026-09-24 | **是（兩個 major）** |
| `vite-ssr-components` | ^0.5.1 | 0.5.1 | 0.8.0 | 2026-09-15 | 0.x minor |
| `wrangler` | ^4.54.0 | 4.54.0 | 4.141.0 | 2026-09-25 | 否 |
| `@types/psl` | 1.1.3 | 1.1.3 | 1.11.0（已棄用） | 2025-07-29 | — |
| `typescript`（未宣告） | — | 5.9.3 | 7.0.2 | — | **是** |

注意事項：

- 多個套件的最新版在查核日前 1–4 天內發布（`@cloudflare/workers-types`、`wrangler`、`@cloudflare/vite-plugin`、`@simplewebauthn/server`、`resend`、`hono`、`lucide`、`daisyui`、`vite`、`vite-plus`）。bun 支援在 `bunfig.toml` 設定 `[install] minimumReleaseAge`（單位為秒），可以擋掉太新的版本（來源：bun install 文件）。這是選用的供應鏈防護。
- `@cloudflare/workers-types` 的 4.x 最後一版是 4.20260702.1（2026-07-02），之後只發布 5.x。
- `npm view` 顯示 `conventional-changelog-cli` 已棄用，訊息是「Please use the conventional-changelog package instead」。`@types/psl` 已棄用，訊息是「psl provides its own type definitions」。`psl@1.15.0` 的 `package.json` 有 `"types": "types/index.d.ts"`。

### 2.2 跨 major 升級對本專案的影響

#### Vite 6 → 8

來源：Vite 7 migration guide、Vite 8 migration guide。

| 變更 | 對本專案的影響 |
| --- | --- |
| Vite 7：Node.js 需要 20.19+ / 22.12+ | 本機 Node 是 v26.10.0，沒有影響。 |
| Vite 7：`build.target` 預設改為 `baseline-widely-available` | 客戶端 JS 的瀏覽器下限提高。Vite 8 再提高到 Chrome 111、Safari 16.4 等。需要確認使用者的瀏覽器。 |
| Vite 7：移除 Sass legacy API、`splitVendorChunkPlugin` | 專案沒有使用。 |
| Vite 8：改用 Rolldown 與 Oxc，取代 esbuild 與 Rollup | `vite.config.ts` 沒有 `esbuild`、`rollupOptions` 設定。 |
| Vite 8：CommonJS default import 行為改變 | 唯一的 default import 是 `import psl from 'psl'`（`src/services/webauthn.ts:5`）。`psl` 有 ESM 進入點（`exports.import: ./dist/psl.mjs`），實測建置成功。 |
| Vite 8：CSS 壓縮預設改用 Lightning CSS | 實測建置成功。沒有比對 CSS 內容差異。 |
| Vite 8：設定檔使用 `__dirname` 會出現警告 | 實測出現警告：`__dirname (vite.config.ts:11:20). Use import.meta.dirname instead`。建議改為 `import.meta.dirname`。 |

實測（scratchpad 複本，Vite 8.3.1 + `@cloudflare/vite-plugin` 1.60.2 + `wrangler` 4.141.0 + `vite-ssr-components` 0.8.0 + Tailwind 4.3.3 + Hono 4.13.9）：

- `tsc --noEmit`：通過。
- `vite build`：通過。Worker bundle 從 2,228.45 kB 降為 1,966.81 kB。客戶端 chunk 的切分方式不同（例如沒有獨立的 `subscriptionModal` chunk）。
- `vite preview`：`GET /` 200、`GET /doc` 200。HTML 內的 CSS 與 JS 標籤正確指向 `/assets/*`。
- `vite dev`：`GET /` 200、`/src/style.css` 200、`/src/client/icons.ts` 200。`vite-ssr-components` 0.8.0 多注入一個 `virtual:vite-ssr-components/hot-reload` script（0.8.0 新功能，PR #48）。

#### `@simplewebauthn/*` 13 → 14

來源：SimpleWebAuthn `CHANGELOG.md`。

- CHANGELOG 列出的唯一 breaking change：最低執行環境改為 Node LTS 22.x 與 Deno 2.4.x。本專案的伺服器端執行於 Cloudflare Workers（workerd），不在這個清單內。**Workers 的支援狀態：未驗證。**
- 14.0.0 在支援的執行環境中，`generateRegistrationOptions()` 會把 ML-DSA-44 排為最優先的演算法。workerd 是否被判定為支援：未驗證。
- **CHANGELOG 沒有列出、但實測發現的變更**：`@simplewebauthn/server@14.0.3` 不再匯出 `AuthenticatorTransportFuture` 型別。`tsc` 錯誤：`src/types/webauthn.ts(2,3): error TS2724: '"@simplewebauthn/server"' has no exported member named 'AuthenticatorTransportFuture'. Did you mean 'AuthenticatorTransport'?`。新套件中只有 `AuthenticatorTransport = "ble" | "hybrid" | "internal" | "nfc" | "usb"`（`esm/types/dom.d.ts:543`）。舊型別另含 `"cable"`、`"smart-card"`（見 CHANGELOG 舊版紀錄）。已儲存在 KV 的 `transports` 若含有這兩個值，需要檢查。
- 14.0.2 修正兩個 Moderate 等級的安全問題（GHSA-2g3p-m8c9-hhwh、GHSA-j3h4-m3m2-7p7j），與憑證撤銷（CRL）有關。13.3.2 也修正一個 Low 等級問題（GHSA-6hxq-p678-4hr2）。這些修正都只在 14.x 或 13.3.x 內。
- 建議：單獨一個步驟升級，並手動測試 passkey 註冊與登入。

#### `lucide` 0.562 → 1.48

來源：lucide 1.0.1 release notes、Lucide Version 1 指南。

- 移除品牌圖示、移除 UMD build（`lucide` 套件例外）、`aria-hidden` 預設為 `true`。
- 本專案使用的 21 個名稱在 1.48.0 仍然存在。其中 3 個變成別名：`Edit3` → `PenLine`、`Fingerprint` → `FingerprintPattern`、`Trash2` → `Trash`（`lucide/dist/lucide.d.ts`）。圖示外觀可能改變，需要目視確認。
- 實測：`vite build` 通過。

#### `@cloudflare/workers-types` 4 → 5

來源：cloudflare/workerd PR #3741、套件 README。

- v5 只保留最新版的執行環境型別與 `/experimental`。套件內只有 `index.d.ts`、`experimental/`。
- 本專案 `tsconfig.json` 使用 `@cloudflare/workers-types/2023-07-01`。實測 v5 會出現 `TS2688: Cannot find type definition file for '@cloudflare/workers-types/2023-07-01'`。改成 `@cloudflare/workers-types` 後 `tsc` 通過。
- Cloudflare 建議改用 `wrangler types` 產生型別。本專案已有 `worker-configuration.d.ts`，但 `tsconfig.json` 的 `include` 只有 `src/**/*`，所以 `tsc` 目前沒有使用它。這個檔案與 `lib: ["DOM"]` 衝突（見 5.4 節的實測）。要完全改用 `wrangler types`，需要把客戶端與 Worker 分成兩個 tsconfig。這是另一個工作項目，不列入本次升級。

#### `bumpp` 10 → 12

來源：bumpp v11.0.0、v12.0.0 release notes。

- v11 要求 Node 20.19。v12 移除 Node 20 支援，`engines` 為 `^22.18.0 || ^24.11.0 || >=26.0.0`。本機 Node 26.10.0 符合。`bump.config.ts` 的選項沒有被列為變更。

#### `eslint` 9 → 10、`@antfu/eslint-config` 6 → 9

本計畫會移除這兩個套件，所以只列出重點。若決定保留 ESLint：

- ESLint 10 移除 eslintrc 格式，`eslint:recommended` 新增 `no-unassigned-vars`、`no-useless-assignment`、`preserve-caught-error`（來源：ESLint v10 migration guide）。
- `@antfu/eslint-config` v7 升級 perfectionist 到 v5，v8、v9 只影響 React 設定（來源：antfu/eslint-config release notes）。

---

## 3. Hono 升級（問題 2）

### 3.1 版本狀態

- 最新版：`hono@4.13.9`（2026-09-24）。
- Hono v5：**尚未發布**。npm dist-tags 只有 `latest: 4.13.9`。GitHub 有開放中的 issue「v5 features list」（honojs/hono#5106）。

### 3.2 本專案使用的 Hono API

來源：`grep` `src/`。

- `hono`：`Context`、`Next` 型別（`src/middleware/auth.ts`、`src/utils/crypto.ts`、`src/utils/response.ts`、`src/routes/notify.ts`）
- `hono/jsx-renderer`：`jsxRenderer`（`src/renderer.tsx`）
- `hono/jsx`、`hono/jsx/dom`：`useMemo`、`render`、`/** @jsxImportSource hono/jsx/dom */`（`src/components/admin/*`、`src/client/admin/tableRenderer.tsx`）
- 中介層：`logger`、`prettyJSON`、`cors()`（沒有 `credentials`）、`csrf()`（`src/index.tsx`）
- `hono/jwt`：`sign(payload, secret, 'HS256')`、`verify(token, secret, 'HS256')`（`src/utils/crypto.ts:45,68`）
- `hono/cookie`：`getCookie`、`setCookie`、`deleteCookie`
- `c.req.parseBody()`（`src/routes/auth.ts:113`）
- `@hono/zod-openapi`：`OpenAPIHono` 搭配 `defaultHook`、`createRoute`、`.openapi()`、`app.doc()`（`src/openapi.ts`、`src/routes/*.ts`）
- `@hono/swagger-ui`：`swaggerUI({ url: '/doc' })`
- `vite-ssr-components/hono`：`Link`、`Script`、`ViteClient`

### 3.3 4.11.0 之後的變更

來源：honojs/hono GitHub releases v4.11.1–v4.13.9。

沒有標示為 breaking 的變更。下列項目與本專案有關：

| 版本 | 變更 | 對本專案 |
| --- | --- | --- |
| 4.11.4 | JWT middleware 必須明確指定 `alg`（GHSA-f67f-6cw9-8mq4） | 專案直接呼叫 `sign`/`verify` 並傳入 `'HS256'`，沒有使用 `jwt()` middleware。沒有影響。 |
| 4.11.7 | 多項安全修正，包含 `ErrorBoundary` XSS | 專案沒有使用 `ErrorBoundary`。 |
| 4.12.4、4.12.12、4.12.21 | `setCookie()` 驗證 cookie 名稱與屬性 | 專案使用 `setCookie`。只要名稱與屬性合法，就沒有影響。 |
| 4.12.6 | JSX `<link>` hoisting 行為對齊 React 19 | 實測 dev 與 preview 的 `<head>` 內容與目前相同（只多出 hot-reload script）。 |
| 4.12.14、4.12.16、4.12.27、4.12.34、4.13.7 | `hono/jsx` SSR 的多項安全修正（屬性名稱、標籤名稱、per-request context、`memo()`、boundary 元件字串跳脫） | 專案使用 `hono/jsx` SSR，應升級。 |
| 4.12.25 | `cors()` 在 `credentials: true` 且沒有 `origin` 時會反射任意 Origin | 專案的 `cors()` 沒有 `credentials`，沒有直接影響。 |
| 4.12.34 | `cors()` 預設解析 `Access-Control-Request-Headers` 時的 ReDoS | 專案使用預設 `cors()`，應升級。 |
| 4.13.0 | `RegExpRouter` 在註冊路由時就丟出 `UnsupportedPathError` | 實測啟動成功。 |
| 4.13.0 | CORS 預設 `Allow-Methods` 加入 `QUERY` | 回應標頭多一個值，沒有功能影響。 |
| 4.13.0 | `useRef`/`RefObject` 型別對齊 React 19 | 專案沒有使用 `useRef`。 |
| 4.13.5 | query 解析在 `#` 之後停止；`parseBody()` 點號巢狀限制 | 專案使用 `parseBody()` 但沒有 `dot: true`。 |

### 3.4 周邊套件相容性

| 套件 | 目標版本 | `peerDependencies.hono` | 結果 |
| --- | --- | --- | --- |
| `@hono/zod-openapi` | 1.6.3 | `>=4.10.0`（另需 `zod ^4.0.0`） | 相容 |
| `@hono/zod-validator` | 0.9.1 | `>=4.11.2` | 相容。本專案程式碼沒有直接 import 它，它是 `@hono/zod-openapi` 的相依套件。 |
| `@hono/swagger-ui` | 0.6.1 | `>=4.0.0` | 相容 |
| `vite-ssr-components` | 0.8.0 | 沒有 peer | 0.5.2 加入 Vite 8 支援，0.7.1 修正 Vite 6/7 的 `rollupOptions` 讀取。實測可用。 |

### 3.5 `@hono/zod-openapi` 的行為變更（會影響 API 呼叫端）

來源：honojs/middleware `packages/zod-openapi/CHANGELOG.md`、PR #2087。

1. **1.5.0：子應用程式繼承父應用程式的 `defaultHook`。** `src/openapi.ts` 的父應用程式有 `defaultHook`，`src/routes/*.ts` 的子應用程式沒有。實測驗證錯誤的回應內容改變：
   - 升級前：`{"success":false,"error":{"name":"ZodError","message":"[ ... ]"}}`，狀態碼 400。
   - 升級後：`{"success":false,"message":"請求驗證失敗","errors":[{"path":"content","message":"..."}]}`，狀態碼 400。
   - 新格式符合 `defaultHook` 原本的設計。但 `POST /api/notify/{token}` 的第三方呼叫端若解析舊格式，需要更新。
2. **1.6.3：Content-Type 不符合宣告的 media type 時回傳 415。** 實測：
   - 升級前：`POST /api/login`，`Content-Type: application/x-www-form-urlencoded` → 401（帳密錯誤，表示有進入 handler）。
   - 升級後：同樣的請求 → `415 Unsupported Media Type`。
   - JSON 登入不受影響（實測 401，帳密錯誤）。前端 `src/client/login/index.ts:50` 使用 JSON，所以網頁登入不受影響。
   - 修正方法：在 `loginRoute` 的 `request.body.content` 加上 `'application/x-www-form-urlencoded'` 與 `'multipart/form-data'`。

---

## 4. Vite 與 Vite+（問題 3）

### 4.1 Vite+ 是什麼

來源：`vite-plus@1.0.0-rc.0` 套件內的 `docs/guide/index.md`、`docs/guide/why.md`。

- 一個 npm 套件（`vite-plus`）與一個全域 CLI（`vp`）。整合 Vite、Vitest、Oxlint、Oxfmt、Rolldown、tsdown、Vite Task（任務執行與快取）。
- 全域 CLI 也管理 Node.js 版本與套件管理工具（`vp env`）。可以用 `vp env off` 關閉這個行為。

### 4.2 版本狀態與授權

| 項目 | 狀態 | 來源 |
| --- | --- | --- |
| 最新版 | `1.0.0-rc.0`，2026-09-22 | npm registry |
| 發展歷程 | 2025-10-13 公布，當時規劃為商業授權（source-available，個人與小型企業免費）；2026-03-13 alpha，改為 MIT；2026-07-02 beta；2026-09-22 1.0 RC | VoidZero 部落格 |
| 授權 | MIT。`vite-plus` 與 `@voidzero-dev/vite-plus-core` 的 `LICENSE` 都是 MIT | 套件 tarball |
| 公司狀態 | VoidZero 於 2026-06-04 宣布加入 Cloudflare。公告寫明 Vite、Vitest、Rolldown、Oxc、Vite+ 維持 MIT | VoidZero 部落格 |
| 文件中的狀態文字 | rc.0 的 `troubleshooting.md` 仍寫「Vite+ is in beta」 | 套件內文件 |

### 4.3 綁定的工具版本

來源：`vite-plus@1.0.0-rc.0` 與 `@voidzero-dev/vite-plus-core@1.0.0-rc.0` 的 `package.json`；`vp --version` 實測輸出。

- `vite`：以 alias 指向 `@voidzero-dev/vite-plus-core@1.0.0-rc.0`，內含 Vite **8.3.0**、Rolldown 1.2.9、tsdown 0.23.0（`bundledVersions`）
- `oxlint` 1.85.0、`oxfmt` 0.70.0、`oxlint-tsgolint` 7.0.2002
- `vitest` 5.0.1
- `engines.node`：`^22.18.0 || ^24.11.0 || >=26.0.0`

### 4.4 CLI 與設定

- 指令：`vp dev`、`vp build`、`vp preview`、`vp check`（格式化 + lint + 型別檢查）、`vp lint`、`vp fmt`、`vp test`、`vp run`、`vp staged`、`vp hooks`、`vp migrate`、`vp install` 等（`docs/guide/index.md`）。
- 內建指令不能被 `package.json` scripts 覆寫。要執行同名 script，需使用 `vp run <script>` 或 `vpr <script>`（`docs/guide/troubleshooting.md`）。
- 設定集中在 `vite.config.ts`：`import { defineConfig } from 'vite-plus'`，加上 `lint`、`fmt`、`staged`、`run`、`check` 區塊。Vite+ 不建議另外使用 `.oxlintrc.json` 或 `.oxfmtrc.json`（`docs/guide/lint.md`、`docs/guide/fmt.md`）。

### 4.5 相容性

| 項目 | 文件說明 | 實測 |
| --- | --- | --- |
| bun | 文件寫明支援 pnpm、npm、Yarn、Bun，會依 `bun.lock` 偵測（`docs/guide/why.md`、`docs/guide/install.md`）。`vp migrate` 對 bun 有特別規則（`docs/guide/migrate-rules.md`） | `vp migrate` 偵測到 `bun 1.4.2`，在 `package.json` 加入 `overrides.vite` 與 `devEngines.packageManager: bun` |
| `@cloudflare/vite-plugin` | 文件沒有提到。Vite+ 有開放中的 issue #2481：dev server 重啟時若有請求進行中，會永久卡住，只在 Vite+ 下重現 | `vp dev`：`/` 200；`vp build` 成功；`vp preview`：`/` 200 |
| `vite-ssr-components` | 文件沒有提到 | `vp dev` 的 HTML 與一般 Vite 8 相同 |
| `@tailwindcss/vite` | 文件沒有提到。`@tailwindcss/vite@4.3.3` 的 peer 包含 `^8` | `vp dev` 的 `/src/style.css` 200 |
| Vite 版本前提 | 遷移前必須先升級到 Vite 8+（`docs/guide/migrate.md`） | 已在 Vite 8 複本上執行 |

其他開放中的相關 issue：#1671（TanStack Start + `@cloudflare/vite-plugin` 的 React 模組重複）、#1063（`esmExternalRequirePlugin` 在 `vp run` 下無效）。本專案沒有使用 React 與這個 plugin。

### 4.6 `vp migrate` 實測結果

在 Vite 8 複本上執行 `npx --package=vite-plus@1.0.0-rc.0 vp migrate --no-interactive --no-agent --no-editor --no-hooks`：

- `vite.config.ts`：import 改為 `vite-plus`；plugins 包進 `lazyPlugins()`；加入 `lint` 區塊（`typeAware: true`、`typeCheck: true`）與空的 `fmt: {}`；刪除 `eslint.config.mjs`。
- `package.json`：`dev`/`build`/`preview` 改為 `vp dev`/`vp build`/`vp preview`；`lint`/`lint:fix` 改為 `vp lint`/`vp lint --fix`；移除 `eslint` 與 `@antfu/eslint-config`。`deploy`、`typecheck` 沒有改。
- `tsconfig.json`：移除 `baseUrl`（tsgolint 不支援 `baseUrl`）。
- 缺陷一：產生的 lint 設定含有 `import/consistent-type-specifier-style: "top-level"`。oxlint 1.85.0 不接受這個值（只接受 `prefer-top-level` 等），`vp lint` 與 `vp check` 在分析前就失敗。手動改值後才能執行。
- 缺陷二：因為 ESLint plugin 已被移除，所有 JS plugins（antfu、unused-imports、eslint-comments、command、perfectionist、@stylistic、regexp）都被刪除。
- 缺陷三：`fmt: {}` 使用 oxfmt 預設風格（有分號、雙引號）。遷移過程把 2 個檔案（`src/client/admin/index.ts`、`subscriptionModal.ts`）改成這個風格，其餘檔案沒有變更。原因未查明。
- `vp lint`（開啟 `typeCheck`）回報 `worker-configuration.d.ts` 154 個型別錯誤（與 DOM lib 重複宣告），以及 11 個 `no-floating-promises` 警告。這個檔案不在 `tsconfig.json` 的 `include` 內，所以 `tsc` 不會報錯。需要在 `lint.ignorePatterns` 排除它。

### 4.7 比較：一般 Vite 8 與 Vite+

| 項目 | 一般 Vite 8 | Vite+ 1.0.0-rc.0 |
| --- | --- | --- |
| 狀態 | Vite 8.3.1 正式版 | 1.0 RC，文件仍稱 beta |
| 與 `@cloudflare/vite-plugin` | peer 範圍明列 `^8.0.0`（≥1.29.0） | 沒有官方說明；有開放中的 dev 問題 #2481 |
| 實測 | `tsc`、build、preview、dev 通過 | build、preview、dev 通過；`vp lint` 需要手動修正 |
| lint / format | 需要另外安裝 `oxlint`、`oxfmt` | 內建，版本與獨立套件相同 |
| 型別檢查 | `tsc --noEmit` | 可以用 `vp check`（tsgolint）取代，需要移除 `baseUrl` |
| Git hooks | 繼續使用 `simple-git-hooks` | `vp migrate` 不會轉換 `simple-git-hooks`，需要手動遷移到 `vp staged` |
| 退出成本 | 低 | 中（`vite` 被 alias 到 `vite-plus-core`，設定集中在 `vite.config.ts`） |

建議：先做一般 Vite 8 升級。Vite+ 等 1.0 正式版，並確認 #2481 的狀態後再評估。

---

## 5. ESLint → oxlint（問題 4）

### 5.1 狀態與版本

- `oxlint` 1.85.0（2026-09-21）。1.0.0 於 2025-06-10 發布（npm registry）。
- 內建規則：870 條（`oxlint --rules -f json` 實測）。文件寫「more than 865 rules」。
- 設定檔：`.oxlintrc.json`（JSON / JSONC）。`oxlint.config.ts` 等 JS/TS 設定檔在 `--help` 中標示為 experimental，需要以 Node.js 執行。
- `--fix` 支援。另有 `--fix-suggestions` 與 `--fix-dangerously`（`oxlint --help`）。
- Type-aware linting：2026-07-22 宣布 stable，實作 typescript-eslint 61 條 type-aware 規則中的 59 條。需要另外安裝 `oxlint-tsgolint`。文件寫明需要 TypeScript 7.0+，並且不支援 `tsconfig.json` 的 `baseUrl`（oxc.rs type-aware 文件、部落格）。`--type-check` 在 `oxlint --help` 中標示為 experimental。實測：在 Vite+ 複本中，專案安裝的是 TypeScript 5.9.3，type-aware 規則與型別檢查仍可執行（tsgolint 自帶 TypeScript Go）。這與文件的「需要 TS 7」說法不一致，原因未查明。
- JS plugins（載入 ESLint plugin）：alpha（oxc.rs JS plugins 文件）。不支援自訂 parser 與依賴型別資訊的規則。

### 5.2 目前啟用的 ESLint 規則與 oxlint 覆蓋率

資料來源：`eslint --print-config` 取得 `src/index.tsx` 與 `src/utils/time.ts` 的有效規則，共 297 條；與 `oxlint --rules` 比對。

| 前綴（antfu 命名） | 啟用數 | oxlint 原生支援 | 缺少的規則 |
| --- | --- | --- | --- |
| ESLint 核心 | 80 | 75 | `no-restricted-syntax`、`no-octal`、`no-octal-escape`、`no-undef-init`、`dot-notation`（oxlint 只有 type-aware 的 `typescript/dot-notation`） |
| `ts/`（typescript-eslint） | 26 | 26 | 無（其中 5 條在 oxlint 為 `eslint/` 範圍） |
| `unicorn/` | 15 | 15 | 無 |
| `import/` | 6 | 6 | 無 |
| `jsdoc/` | 17 | 10 | `check-param-names`、`check-types`、`no-multi-asterisks`、`require-returns-check`、`require-yields-check`、`check-alignment`、`multiline-blocks` |
| `node/`（eslint-plugin-n） | 8 | 4 | `no-deprecated-api`、`prefer-global/buffer`、`prefer-global/process`、`process-exit-as-throw` |
| `unused-imports/` | 2 | 0 | 由 `eslint/no-unused-vars` 取代偵測。自動移除未使用 import 的修正類型為 `conditional_dangerous_fix_or_suggestion`，一般 `--fix` 是否會移除：未驗證 |
| `perfectionist/` | 4 | 0 | 由 oxfmt 的 `sortImports` 取代（`@oxlint/migrate` 的警告訊息） |
| `style/`（@stylistic） | 65 | 0 | 由 oxfmt 取代 |
| `regexp/` | 60 | 0 | 全部遺失，除非用 JS plugin 載入 `eslint-plugin-regexp` |
| `antfu/` | 9 | 0 | 全部遺失（`top-level-function`、`if-newline`、`import-dedupe`、`no-import-dist` 等） |
| `eslint-comments/` | 4 | 0 | 遺失。oxlint 有 `--report-unused-disable-directives` 可部分替代 |
| `command/` | 1 | 0 | 遺失 |

目前程式碼的實際檢查結果（實測）：

- ESLint（`src/`）：`no-console` 11、`unused-imports/no-unused-vars` 10、`jsdoc/check-param-names` 3，全部是 warning。
- oxlint（`@oxlint/migrate` 產生的設定，含 JS plugins，手動修正後）：`no-console` 11、`unused-imports(no-unused-vars)` 10。只少了 3 個 `jsdoc/check-param-names`。

### 5.3 `@oxlint/migrate` 實測

指令：`npx @oxlint/migrate@1.85.0 --details --type-aware`（在 scratchpad 複本中執行）。

- 產生 299 條規則，跳過 19 條（13 條未實作、4 條不支援、2 條 nursery）。
- 保留 7 個 JS plugins：`eslint-plugin-antfu`、`eslint-plugin-unused-imports`、`eslint-plugin-eslint-comments`、`eslint-plugin-command`、`eslint-plugin-perfectionist`、`@stylistic/eslint-plugin`、`eslint-plugin-regexp`。
- 加入 1,096 個 globals（因為 `globals` 套件版本不同，工具本身有提出警告）。
- 缺陷一：plugin 名稱猜錯。實際套件是 `@eslint-community/eslint-plugin-eslint-comments`，產生的設定寫成 `eslint-plugin-eslint-comments`，oxlint 載入失敗。README 的 caveat 有提到「Tries to guess the plugin name」。
- 缺陷二：`import/consistent-type-specifier-style` 的值 `"top-level"` 不被 oxlint 接受（與 `vp migrate` 相同問題）。

### 5.4 建議的 oxlint 設定方向

- 使用 oxlint 原生規則，不載入 `@stylistic`（與 oxfmt 衝突）。
- `perfectionist` 的 import 排序改由 oxfmt `sortImports` 處理。
- `eslint-plugin-regexp` 是否用 JS plugin 保留：需要決定（JS plugins 仍為 alpha）。
- 用 `ignorePatterns` 排除 `index.js`、`dist/**`、`worker-configuration.d.ts`。
- 規則 severity 沿用現況：`no-console: warn`、`no-alert: off`、`no-unused-vars: warn`。

### 5.5 「不使用 `any`」規則的強制方式

- 現況：`AGENTS.md` 的 Code style 寫「TypeScript 一律不使用 any 型別」。但 `@antfu/eslint-config` 關閉了 `ts/no-explicit-any`，所以目前沒有工具強制。
- `src/` 內有 18 處 `any`，位於 `src/utils/logger.ts`、`src/utils/formAdaptor.ts`、`src/client/icons.ts`、`src/client/config/index.ts`、`src/client/login/webauthn.ts`、`src/services/config.ts`、`src/services/webauthn.ts`、`src/services/notifier/channels/bark.ts`、`src/services/notifier/types.ts`、`src/services/notifier/channels/telegram.ts`。
- oxlint 設定：`"typescript/no-explicit-any": "error"`（原生規則，不需要 type-aware）。
- 選用：開啟 type-aware 後可加上 `typescript/no-unsafe-assignment`、`no-unsafe-argument`、`no-unsafe-member-access`，攔截隱含的 `any` 流動。
- 開啟 `error` 之前，要先修正這 18 處，或先設為 `warn`。

---

## 6. 格式化工具 → oxfmt（問題 5）

### 6.1 狀態

- `oxfmt` 0.70.0（2026-09-21）。尚未 1.0。
- Alpha：2025-12-01；Beta：2026-02-24（oxc.rs 部落格）。
- Prettier 相容性：「Oxfmt now passes 100% of Prettier's JavaScript and TypeScript conformance tests」（oxc.rs formatter 文件）。
- 支援檔案類型：JavaScript、JSX、TypeScript、TSX、JSON、JSONC、JSON5、YAML、TOML、HTML、Vue、CSS、SCSS、Less、Markdown、MDX、GraphQL 等（oxc.rs formatter 文件）。
- 設定檔：`.oxfmtrc.json`；`-c` 也接受 `.jsonc`、`.ts`、`.mts`、`.cts`、`.js`、`.mjs`、`.cjs`（`oxfmt --help`）。預設讀取 `.gitignore` 與 `.prettierignore` 作為忽略清單。
- 內建功能：import 排序（`sortImports`，預設關閉）、Tailwind class 排序（`sortTailwindcss`，預設關閉）、`package.json` 欄位排序（`sortPackageJson`，預設開啟）。
- 預設值：`printWidth: 100`、`semi: true`、`singleQuote: false`、`arrowParens: "always"`、`trailingComma: "all"`（oxfmt 設定檔參考）。

### 6.2 能否重現目前的 antfu 風格

目前有效的 @stylistic 設定（`eslint --print-config`）：

| 規則 | 目前設定 | oxfmt 可對應的選項 |
| --- | --- | --- |
| `style/semi` | `never` | `semi: false` ✔ |
| `style/quotes` | `single` | `singleQuote: true` ✔ |
| `style/indent` | 2 | `tabWidth: 2` ✔ |
| `style/comma-dangle` | `always-multiline` | `trailingComma: "all"` ✔ |
| `style/arrow-parens` | `as-needed` + `requireForBlockBody` | 只有 `always` / `avoid`，**無法完全對應** |
| `style/brace-style` | `stroustrup`（`}` 與 `else` 分行） | **沒有選項**，固定為 `} else {` |
| `style/member-delimiter-style` | 多行不加分隔符號，單行用逗號 | **沒有選項**，固定用 `;` |
| `style/quote-props` | `consistent-as-needed` | `quoteProps: "consistent"`，行為接近但不一定相同 |
| 行寬 | antfu 沒有行寬限制 | `printWidth` 一定會生效，會重新斷行 |
| `antfu/if-newline` | 單行 `if` 的主體換行 | **沒有選項**，oxfmt 會併成一行 |

結論：oxfmt **無法重現**目前的風格。首次執行會產生大量差異。

### 6.3 格式差異實測

設定 `semi: false`、`singleQuote: true`、`trailingComma: "all"`、`quoteProps: "consistent"`，對 `src/`（58 個檔案）執行 oxfmt 0.70.0：

| `arrowParens` | `printWidth` | 變更檔案數 | 新增行 | 刪除行 |
| --- | --- | --- | --- | --- |
| `always` | 100 | 46 | 1,071 | 975 |
| `always` | 120 | 48 | 902 | 1,170 |
| `avoid` | 100 | 46 | 1,078 | 982 |
| `avoid` | 120 | 48 | 913 | 1,183 |
| `avoid` | 80 | 47 | 1,928 | 1,164 |

`src/index.tsx` 的差異範例：`}\n else {` 改為 `} else {`；三行的 `if ... \n stats.x++` 併為一行；`{ success: boolean, data?: any }` 改為 `{ success: boolean; data?: any }`。

`src/style.css`：縮排從 4 格改為 2 格，daisyui `@plugin` 區塊內的 `"light"` 改為 `'light'`，顏色改為小寫。實測格式化前後的建置 CSS **逐位元組相同**（85,996 bytes）。

建議：

- 用 `printWidth: 120` 與 `arrowParens: "always"`，差異最小。
- 格式化獨立為一個 commit，並把該 commit 的 hash 加入 `.git-blame-ignore-revs`（Git 的 `blame.ignoreRevsFile` 功能）。

---

## 7. 整合計畫（問題 6）

### 7.1 `package.json` scripts（獨立 oxlint / oxfmt 方案）

```json
{
  "lint": "oxlint",
  "lint:fix": "oxlint --fix",
  "fmt": "oxfmt",
  "fmt:check": "oxfmt --check",
  "typecheck": "tsc --noEmit",
  "check": "bun run fmt:check && bun run lint && bun run typecheck",
  "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s"
}
```

- `changelog` 換成 `conventional-changelog` 8.x 後，README 只示範 `-p angular`。`-i`、`-s` 是否仍支援：未驗證，請用 `conventional-changelog --help` 確認。它另外需要安裝 `conventional-changelog-angular`（README 的安裝指令）。
- 若日後改用 Vite+，這些 scripts 由 `vp migrate` 改寫為 `vp lint`、`vp fmt`、`vp check`。

### 7.2 Git hooks

現況（本機 `.git/hooks` 與 repo 設定不一致）：

| Hook | `.simple-git-hooks.mjs` | 實際安裝的 `.git/hooks/*` |
| --- | --- | --- |
| pre-commit | `bun run lint:fix` | gitleaks 掃描，接著 `bun run lint:fix` |
| pre-push | `bun run typecheck` | `bun run typecheck && bun run test` |

- `package.json` 沒有 `test` script。實測 `bun run test` 會執行 `/bin/test` 並以 exit code 1 結束，所以目前安裝的 pre-push hook 會擋下所有 push。
- 重新執行 `simple-git-hooks` 會用 repo 設定覆蓋本機 hook，gitleaks 掃描會消失。

建議的 `.simple-git-hooks.mjs`：

```js
export default {
  'pre-commit': 'gitleaks git --staged --no-banner && bun run fmt:check && bun run lint',
  'pre-push': 'bun run typecheck',
}
```

- 改成檢查模式（不自動修正），因為目前的 `lint:fix` 修改檔案後不會重新 stage。是否保留自動修正：需要決定。
- gitleaks 未安裝時的處理方式要保留（目前的 hook 會印出訊息並略過）。
- 更新設定後執行 `bunx simple-git-hooks` 重新安裝。

### 7.3 編輯器設定

`.vscode/settings.json` 目前關閉 Prettier，用 ESLint 修正並隱藏 stylistic 規則。改為（來源：Vite+ `docs/guide/ide-integration.md`，同樣適用獨立的 oxc 擴充套件）：

```json
{
  "editor.defaultFormatter": "oxc.oxc-vscode",
  "[typescript]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "oxc.oxc-vscode" },
  "editor.formatOnSave": true,
  "editor.formatOnSaveMode": "file",
  "editor.codeActionsOnSave": { "source.fixAll.oxc": "explicit" }
}
```

- 刪除 `eslint.rules.customizations`、`eslint.validate`、`source.fixAll.eslint`。
- `formatOnSaveMode: "file"` 的原因：oxfmt 不支援部分格式化。
- 其他設定（Copilot、cSpell）保留。

### 7.4 `AGENTS.md` 需要更新的段落

| 行號 | 段落 | 更新內容 |
| --- | --- | --- |
| 29–47 | Dev Environment Tips | Vite 8；`vite.config.ts` 改用 `import.meta.dirname` |
| 60–92 | Build and Test Commands | `lint` 改為 oxlint；新增 `fmt`、`fmt:check`、`check`；刪除「Uses `@antfu/eslint-config`」 |
| 62–64 | Full Check Suite | 改為 `bun run check && bun run build` |
| 96–98 | Code style | 註明 `any` 由 `typescript/no-explicit-any` 強制；格式由 oxfmt 負責 |
| 140–147 | PR Checklist | 加入 `bun run fmt:check` |
| 227–230 | Release Best Practices | 同上 |
| 298–301 | Why Vite for Workers? | 更新為 Vite 8（Rolldown） |
| 310–317 | Adding New Features | 更新驗證指令 |
| 364–381 | Quick Reference | 更新 lint、fmt 指令 |

新增段落：pre-commit hook 的實際行為（gitleaks + fmt:check + lint）。

---

## 8. 遷移步驟

每一步完成後都執行 `bun run typecheck && bun run build`。每一步是一個獨立 commit。

1. **明確加入 `typescript`。** `bun add -d typescript@~5.9.3`。原因：目前 `tsc` 只是 ESLint 相依的 peer。風險：低。
2. **修正 hook 設定漂移。** 更新 `.simple-git-hooks.mjs`（見 7.2），移除 pre-push 的 `test`。風險：低。
3. **Hono 家族升級。** `hono@^4.13.9`、`@hono/zod-openapi@^1.6.3`、`@hono/zod-validator@^0.9.1`、`@hono/swagger-ui@^0.6.1`、`zod@^4.6.5`。同一個 commit 修正 `loginRoute` 的 media type。手動測試：JSON 登入、表單登入、`/doc`、`/ui`、一個會觸發驗證錯誤的 API。風險：**中**（415、錯誤回應格式改變）。
4. **Vite 8 與 Cloudflare 工具。** `vite@^8.3.1`、`@cloudflare/vite-plugin@^1.60.2`、`wrangler@^4.141.0`、`vite-ssr-components@^0.8.0`、`tailwindcss@^4.3.3`、`@tailwindcss/vite@^4.3.3`、`daisyui@^5.7.46`。`vite.config.ts` 的 `__dirname` 改為 `import.meta.dirname`。執行 `bun run cf-typegen`。驗證：`bun run dev`、`bun run preview`、用 staging 環境部署一次（`wrangler deploy --env staging`）。風險：中。
5. **小版本更新。** `date-fns`、`resend`、`@types/bun`、`simple-git-hooks`、`bumpp@^12`。移除 `@types/psl`。把 `conventional-changelog-cli` 換成 `conventional-changelog` + `conventional-changelog-angular`，並用 `bun run release:dry` 與 `bun run changelog` 驗證。風險：低。
6. **`@cloudflare/workers-types` v5。** `tsconfig.json` 的 `types` 改為 `@cloudflare/workers-types`。風險：中（最新版的執行環境型別可能與 `compatibility_date = 2025-12-10` 不一致）。
7. **加入 oxfmt，並獨立 commit 格式化結果。** 新增 `.oxfmtrc.json`（`semi: false`、`singleQuote: true`、`printWidth: 120`、`arrowParens: "always"`、`trailingComma: "all"`、`quoteProps: "consistent"`、`sortImports` 開啟）。這一步 ESLint 仍然存在，所以要**同時**在 `eslint.config.mjs` 設定 `stylistic: false` 並關閉 perfectionist 排序，否則 `eslint --fix` 會把格式改回去。執行 `bun run fmt`，commit，把 hash 加入 `.git-blame-ignore-revs`。風險：中（大量差異、進行中的分支會衝突）。
8. **加入 oxlint 並移除 ESLint。** 用 `@oxlint/migrate` 產生初稿，手動修正 5.3 節的缺陷，刪除 `@stylistic` 與 perfectionist，加入 `typescript/no-explicit-any`（先設 `warn`）。移除 `eslint`、`@antfu/eslint-config`、`eslint.config.mjs`。更新 scripts、hooks、`.vscode/settings.json`、`AGENTS.md`。風險：中（regexp、antfu、7 條 jsdoc、4 條 node 規則遺失）。
9. **修正 18 處 `any`，把 `typescript/no-explicit-any` 改為 `error`。** 風險：低到中（`window as any` 類的寫法需要宣告全域型別）。
10. **`@simplewebauthn/*` v14。** `AuthenticatorTransportFuture` 改為 `AuthenticatorTransport`，並檢查 KV 內既有憑證的 `transports` 值。在 staging 測試 passkey 註冊、登入、刪除。風險：**中**。
11. **`lucide` v1。** 目視檢查 `Edit3`、`Fingerprint`、`Trash2` 三個圖示。風險：低到中。
12. **（選用）type-aware lint。** 安裝 `oxlint-tsgolint`；`tsconfig.json` 移除 `baseUrl`（`paths` 已是 `./src/*`，不受影響）；排除 `worker-configuration.d.ts`。風險：中（實測出現 11 個 `no-floating-promises` 警告）。
13. **（之後）Vite+。** 等 `vite-plus` 1.0 正式版，並確認 issue #2481。執行 `vp migrate`，手動修正產生的 lint 設定，並把 hooks 從 `simple-git-hooks` 手動遷移到 `vp staged`。

### 風險清單

| 風險 | 步驟 | 等級 | 對策 |
| --- | --- | --- | --- |
| 移除 ESLint 後 `tsc` 消失 | 8 | 高 | 先做步驟 1 |
| 表單登入回傳 415 | 3 | 中 | 補上 media type 宣告 |
| 驗證錯誤回應格式改變，影響第三方 `/api/notify` 呼叫端 | 3 | 中 | 在 changelog 說明 |
| 大量格式差異造成分支衝突 | 7 | 中 | 先合併進行中的分支，再格式化 |
| 步驟 7 與 8 之間 ESLint 與 oxfmt 互相改寫 | 7 | 中 | 步驟 7 同時關閉 ESLint stylistic |
| SimpleWebAuthn v14 在 workerd 上的行為未知 | 10 | 中 | staging 測試 |
| 太新的套件版本（供應鏈） | 全部 | 中 | 等待數天，或設定 `minimumReleaseAge` |
| Vite 8 預設瀏覽器下限提高 | 4 | 低 | 確認使用者的瀏覽器 |

---

## 9. 未決問題與未知事項

- SimpleWebAuthn v14 是否支援 Cloudflare Workers（workerd）：未知。CHANGELOG 只列出 Node 22+ 與 Deno 2.4+。
- SimpleWebAuthn v14 移除 `AuthenticatorTransportFuture` 的原因與替代型別：CHANGELOG 沒有記載。本研究只觀察到型別不存在。
- oxlint type-aware 規則在 TypeScript 5.9.3 下可以執行，與文件「需要 TypeScript 7.0+」不一致：原因未知。
- `eslint/no-unused-vars` 在一般 `--fix` 下是否會移除未使用的 import：未驗證。
- `conventional-changelog` 8.x 是否支援 `-i`、`-s` 參數：未驗證。
- `vp migrate` 只重新格式化 2 個檔案的原因：未查明。
- Vite+ 是否預設啟用 Vite 8 的 full bundle mode（issue #2481 提到 bundled-dev pipeline）：未知。
- Vite+ 1.0 正式版的發布日期：未公布。
- 本研究沒有逐一閱讀 `zod` 4.2–4.6、`resend` 6.7–6.30、`date-fns` 4.2–4.4、`daisyui` 5.6–5.7、`wrangler` 4.55–4.141 的 release notes。這些升級只以 `tsc`、建置、預覽的實測結果作為證據。
- 本研究沒有測試 Cron trigger（`scheduled`）與 KV 寫入在新版本下的行為。
- 本研究沒有實際部署到 Cloudflare。
- 決策事項：pre-commit 要自動修正還是只檢查；是否用 JS plugin 保留 `eslint-plugin-regexp`；`printWidth` 的值。

---

## 10. 來源

查核日期皆為 2026-09-26。

### 本機檔案

- `/Users/madao/Desktop/projects/subs-tracker/package.json`、`bun.lock`、`vite.config.ts`、`eslint.config.mjs`、`tsconfig.json`、`wrangler.toml`、`bump.config.ts`、`.simple-git-hooks.mjs`、`.git/hooks/pre-commit`、`.git/hooks/pre-push`、`.vscode/settings.json`、`AGENTS.md`
- `/Users/madao/Desktop/projects/subs-tracker/node_modules/@antfu/eslint-config/dist/index.mjs`（第 1987 行）
- `src/routes/auth.ts`、`src/openapi.ts`、`src/index.tsx`、`src/renderer.tsx`、`src/utils/crypto.ts`、`src/types/webauthn.ts`、`src/client/icons.ts`、`src/style.css`
- npm tarball：`vite-plus@1.0.0-rc.0`（含 `docs/guide/*.md`、`docs/config/*.md`）、`@voidzero-dev/vite-plus-core@1.0.0-rc.0`、`lucide@1.48.0`、`@cloudflare/workers-types@5.20260926.1`

### npm registry

- https://www.npmjs.com/package/hono
- https://www.npmjs.com/package/@hono/zod-openapi
- https://www.npmjs.com/package/@hono/zod-validator
- https://www.npmjs.com/package/@hono/swagger-ui
- https://www.npmjs.com/package/vite
- https://www.npmjs.com/package/vite-plus
- https://www.npmjs.com/package/@cloudflare/vite-plugin
- https://www.npmjs.com/package/@cloudflare/workers-types
- https://www.npmjs.com/package/vite-ssr-components
- https://www.npmjs.com/package/oxlint
- https://www.npmjs.com/package/oxfmt
- https://www.npmjs.com/package/oxlint-tsgolint
- https://www.npmjs.com/package/@oxlint/migrate
- https://www.npmjs.com/package/conventional-changelog-cli
- https://www.npmjs.com/package/conventional-changelog
- https://www.npmjs.com/package/@types/psl
- https://www.npmjs.com/package/typescript

### Hono

- https://github.com/honojs/hono/releases （v4.11.1–v4.13.9）
- https://github.com/honojs/hono/releases/tag/v4.12.0
- https://github.com/honojs/hono/releases/tag/v4.13.0
- https://github.com/honojs/hono/issues/5106
- https://github.com/honojs/middleware/blob/main/packages/zod-openapi/CHANGELOG.md
- https://github.com/honojs/middleware/blob/main/packages/zod-validator/CHANGELOG.md
- https://github.com/honojs/middleware/blob/main/packages/swagger-ui/CHANGELOG.md
- https://github.com/honojs/middleware/pull/2087

### Vite 與 Vite+

- https://vite.dev/guide/migration
- https://v7.vite.dev/guide/migration
- https://viteplus.dev/guide/
- https://viteplus.dev/guide/migrate
- https://viteplus.dev/guide/install
- https://github.com/voidzero-dev/vite-plus
- https://github.com/voidzero-dev/vite-plus/issues/2481
- https://github.com/voidzero-dev/vite-plus/issues/1671
- https://github.com/voidzero-dev/vite-plus/issues/1063
- https://voidzero.dev/posts/announcing-vite-plus
- https://voidzero.dev/posts/announcing-vite-plus-alpha
- https://voidzero.dev/posts/announcing-vite-plus-beta
- https://voidzero.dev/posts/voidzero-cloudflare
- https://github.com/yusukebe/vite-ssr-components/releases

### OXC

- https://oxc.rs/docs/guide/usage/linter.html
- https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html
- https://oxc.rs/docs/guide/usage/linter/type-aware.html
- https://oxc.rs/docs/guide/usage/linter/js-plugins.html
- https://oxc.rs/blog/2026-07-22-type-aware-linting-stable
- https://oxc.rs/docs/guide/usage/formatter.html
- https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html
- https://oxc.rs/docs/guide/usage/formatter/migrate-from-prettier.html
- https://oxc.rs/blog/2025-12-01-oxfmt-alpha.html
- https://oxc.rs/blog/2026-02-24-oxfmt-beta
- https://github.com/oxc-project/oxlint-migrate （README，經由 `npm view @oxlint/migrate readme`）

### Cloudflare

- https://developers.cloudflare.com/workers/vite-plugin/
- https://developers.cloudflare.com/workers/languages/typescript/
- https://github.com/cloudflare/workerd/pull/3741

### 其他套件

- https://github.com/MasterKale/SimpleWebAuthn/blob/master/CHANGELOG.md
- https://github.com/lucide-icons/lucide/releases/tag/1.0.1
- https://lucide.dev/guide/version-1
- https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.2.0
- https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.0
- https://github.com/antfu-collective/bumpp/releases/tag/v11.0.0
- https://github.com/antfu-collective/bumpp/releases/tag/v12.0.0
- https://github.com/antfu/eslint-config/releases
- https://eslint.org/docs/latest/use/migrate-to-10.0.0
- https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
- https://bun.com/docs/pm/cli/install
- https://git-scm.com/docs/git-blame
