# 套件研究：取代 SimpleWebAuthn，或升級 SimpleWebAuthn

- 查核日期：2026-09-26
- 範圍：找出可以取代 `@simplewebauthn/server` 與 `@simplewebauthn/browser`（固定在 13.2.2）的套件，並與「升級 SimpleWebAuthn 並修正打包」、「維持 13.2.2」比較。背景是 issue #9：升級到 13.3.x 或 14.x 後，打包的 Worker 在啟動時失敗（`Cannot get schema for 'AlgorithmIdentifier' target`）。
- 前提條件：只有一個使用者，由部署者自架（`PRODUCT.md`）。伺服器端執行於 Cloudflare Workers（workerd，`compatibility_date = "2025-12-10"`，`nodejs_compat`），以 Vite 8 與 `@cloudflare/vite-plugin` 打包。本文讀取 `origin/main`（`60be723`）的程式碼。
- 標記：
  - 〔查證〕：來自官方文件、npm metadata、套件原始碼、GitHub advisory，或本 repo 的檔案，附出處。
  - 〔實測〕：在 scratchpad 執行得到的結果。本 repo 與 `subs-tracker-webauthn` worktree 的檔案沒有變更。
  - 〔推論〕：由查證事實推得，沒有直接證據。
  - 「查不到」：資料沒有寫，本文不猜。
- 驗證方法：以 `npm view` 讀 metadata，以 `npm pack` 下載套件原始碼閱讀。以 `gh api` 讀 GitHub advisory、repo 狀態與 issue。在 scratchpad 建立一個最小的 Vite 8.3.1 + `@cloudflare/vite-plugin` 1.60.2 + wrangler 4.141.0 Worker 專案，對每個候選套件執行 `vite build` 與 `vite preview`，在 workerd 中完成註冊驗證與 3000 次登入驗證。另外把 `origin/main` 以 `git archive` 複製到 scratchpad，升級到 `@simplewebauthn/server` 14.0.3，執行 `bun run build`、`vite preview`、`tsc`、`bun test`。沒有部署，沒有在 GitHub 建立或修改任何東西。

---

## 1. 摘要與建議

### 1.1 最重要的發現

1. **啟動失敗的直接原因是 `@peculiar/asn1-schema` 有多份實體副本，不是 SimpleWebAuthn 14 本身。** 在 `origin/main` 的 `bun.lock` 上只改 `package.json` 的版號後執行 `bun install`，`node_modules` 中有 13 份 `@peculiar/asn1-schema@2.9.5`（每個 `@peculiar/asn1-*` 下各一份）與頂層的一份 2.6.0。版本只有一個，但每一份副本有自己的 schema 儲存區。錯誤堆疊指向 `@peculiar/asn1-rsa` 模組頂層的 `AsnConvert.serialize()`：它使用自己那一份 `asn1-schema`，找不到 `@peculiar/asn1-x509` 註冊在另一份副本中的 `AlgorithmIdentifier`〔實測〕。刪除 `bun.lock` 重新解析後，每個套件只剩一份，Worker 正常啟動，`POST /api/webauthn/authenticate/options` 回 200，`bun test` 52 個測試全部通過〔實測〕。issue #9 寫「只留一份 2.9.5 之後仍然失敗」，可能只計算了版本數，沒有計算實體副本數〔推論〕。
2. **issue #9 的一項前提不正確。** 13.2.2 已經相依 `@peculiar/x509`（`^1.13.0`，lock 解析為 1.14.2）〔查證：`npm view @simplewebauthn/server@13.2.2 dependencies`、`bun.lock`〕。13.3.x 沒有新增這個相依，只把範圍改成 `^1.14.3`；14.x 改成 `^2.1.0`。
3. **沒有一個候選套件可以直接取代 SimpleWebAuthn。**
   - `@passwordless-id/webauthn` 2.4.0：沒有相依，在 workerd 中可以執行。但它的 ES256 簽章轉換有錯誤：r 或 s 的 DER 整數少於 32 位元組時，驗證失敗。3000 次登入中失敗 24 次，24 次都是這種簽章〔實測〕。它也不支援 EdDSA 驗證〔查證：原始碼〕。
   - `@oslojs/webauthn` 1.0.0：在 workerd 中 3000 次全部成功〔實測〕，但 npm 在 2026-07-29 把它標為「Package no longer supported」〔查證：`npm view`〕。它只解析資料，challenge、origin、旗標與簽章的檢查要自己寫。
   - `fido2-lib` 3.5.9：靜態匯入 Node 的 `crypto` 與 `@peculiar/webcrypto`，並相依 `pkijs`、`asn1js`。「Cloudflare Workers」相容性的 issue #135 從 2023 年開啟至今〔查證〕。沒有實測。
4. **瀏覽器端不需要更換。** `@simplewebauthn/browser` 沒有相依，只在瀏覽器執行，與 Worker 的啟動失敗無關〔查證：`npm view`〕。原生的 `parseCreationOptionsFromJSON()`、`parseRequestOptionsFromJSON()`、`toJSON()` 需要 Safari／iOS 18.4、Chrome 129、Firefox 119 以上〔查證：MDN BCD 8.1.3、WebKit 部落格〕。
5. **13.2.2 的原始碼有這三個安全公告描述的程式路徑，但本專案的暴露很小。** 路徑只在 `/api/webauthn/register/verify` 可以觸發，這個路由需要登入，並且要在 10 分鐘內重新驗證過〔查證：`src/routes/webauthn.ts`〕。

### 1.2 建議

**升級到 `@simplewebauthn/server` 14.0.3 與 `@simplewebauthn/browser` 14.0.0，並重新產生 `bun.lock`，讓 `@peculiar/*` 與 `asn1js` 各只有一份。不更換套件。**

- 升級的程式變更很小：`src/db/passkeys.ts` 的 `AuthenticatorTransportFuture` 改成 `AuthenticatorTransport`；`src/services/passkey.ts` 第 156 行的 `transports` 要轉型（`tsc` 只報這一個錯誤）〔實測〕。
- D1 中的憑證格式不變，不需要重新註冊〔實測：spike 以 COSE 公鑰驗證 3000 次成功；`bun test` 通過〕。
- 在 `bun run check` 或 pre-push 加一項檢查：`node_modules` 中 `@peculiar/asn1-schema` 只能有一份。沒有這項檢查時，之後只更新其中一個套件，副本可能再次分裂〔推論〕。
- 升級後照 `docs/dogfood.md` 第 5 節用真實瀏覽器完成 passkey 註冊與登入。本文只在 workerd 中以軟體驗證器測試。

理由：更換套件的成本與風險都比升級高。`@passwordless-id/webauthn` 會讓約 0.8% 的正常登入失敗，也不能驗證 EdDSA 憑證；`@oslojs/webauthn` 已停止維護，而且要自己寫安全相關的檢查；`fido2-lib` 仍帶入 ASN.1 與 `@peculiar/*` 套件，沒有避開同一類問題。三者都要改寫約 150–250 行，並轉換或重新驗證 D1 中的公鑰。

這個建議的限制：

- 只在本機 workerd 與軟體驗證器（P-256、none attestation）上驗證。真實驗證器、RS256／EdDSA 憑證、正式環境都沒有測試。
- 修正依賴套件管理器的解析結果，不是程式碼的保證。第 6.3 節的檢查只能在副本分裂時提早失敗。
- 另一個 agent 正在 `subs-tracker-webauthn` 查根本原因。本文第 6 節只是重現與一個可行的修正，沒有查到 bun 為什麼沒有提升（hoist）這些套件。

---

## 2. 本專案如何使用 SimpleWebAuthn

### 2.1 使用的 API

| 檔案                              | 匯入                                                                                                                                         | 用途                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/services/passkey.ts`         | `generateRegistrationOptions`、`verifyRegistrationResponse`、`generateAuthenticationOptions`、`verifyAuthenticationResponse`，4 個 JSON 型別 | 註冊與登入的四個步驟                                                                          |
| `src/routes/webauthn.ts`          | 型別 `RegistrationResponseJSON`、`AuthenticationResponseJSON`                                                                                | 請求本體的型別轉換。zod 只檢查 `id` 與 `response.clientDataJSON`，其他欄位交給 SimpleWebAuthn |
| `src/db/passkeys.ts`              | 型別 `AuthenticatorTransportFuture`、`CredentialDeviceType`                                                                                  | D1 資料列的型別                                                                               |
| `src/test/authenticator.ts`       | 4 個 JSON 型別、`isoCBOR`（`@simplewebauthn/server/helpers`）                                                                                | 測試用軟體驗證器的 CBOR 編碼                                                                  |
| `src/client/login/index.ts`       | `startAuthentication`、`browserSupportsWebAuthnAutofill`                                                                                     | 按鈕登入與自動填入（conditional UI）                                                          |
| `src/client/settings/reauth.ts`   | `startAuthentication`                                                                                                                        | 以 passkey 重新驗證身分                                                                       |
| `src/client/settings/Account.tsx` | `startRegistration`                                                                                                                          | 新增 passkey；`InvalidStateError` 顯示「這個裝置已經有這個網站的 passkey」                    |

〔查證：`git grep simplewebauthn origin/main`〕。`src/client/settings/Passkeys.tsx` 沒有使用 SimpleWebAuthn。

### 2.2 設定

- Attestation：沒有指定 `attestationType`，使用預設值 `'none'`〔查證：13.2.2 `generateRegistrationOptions.js` 第 69 行〕。`verifyRegistrationResponse()` 仍然依瀏覽器送來的 `fmt` 驗證 attestation statement（`fido-u2f`、`packed`、`android-key`、`tpm`、`apple` 等）〔查證：13.2.2 `verifyRegistrationResponse.js` 第 160–178 行〕。
- `authenticatorSelection: { residentKey: 'required', userVerification: 'required' }`；`excludeCredentials` 列出既有憑證與 `transports`。
- 公鑰演算法：沒有指定，使用預設的 `[-8, -7, -257]`（EdDSA、ES256、RS256）〔查證：13.2.2 第 48 行〕。所以 D1 中可能有 EdDSA 憑證。正式資料中各演算法的數量：查不到（資料表沒有演算法欄位）。
- 登入：`userVerification: 'required'`。`conditional: true` 時 `allowCredentials` 是空的，前端以 `useBrowserAutofill: true` 啟動自動填入；登入頁的 `<input>` 有 `autocomplete="username webauthn"`〔查證：`src/pages/Login.tsx` 第 24 行〕。
- 同一頁面上的自動填入請求與按鈕登入請求，由 `@simplewebauthn/browser` 的 `WebAuthnAbortService` 取消前一個請求。被取消的請求拋出 `AbortError`，`isCancel()` 不把它當成錯誤〔查證：13.2.2 `webAuthnAbortService.js`、`src/client/shared/api.ts`〕。
- Challenge 存在 D1 `webauthn_challenges`，以 `DELETE … RETURNING` 一次性取用；expected challenge 從 `clientDataJSON` 取出。這部分不依賴 SimpleWebAuthn。

### 2.3 D1 中的憑證格式

`migrations/0001_init.sql` 的 `passkey_credentials`〔查證〕：

| 欄位          | 格式                                                                           |
| ------------- | ------------------------------------------------------------------------------ |
| `id`          | credential ID，base64url                                                       |
| `public_key`  | `registrationInfo.credential.publicKey`（COSE_Key 的 CBOR 位元組）的 base64url |
| `counter`     | 整數，每次登入以 `newCounter` 更新                                             |
| `transports`  | JSON 陣列字串，取自瀏覽器回應的 `response.transports`                          |
| `device_type` | `singleDevice` 或 `multiDevice`                                                |
| `backed_up`   | 0／1／NULL（BS 旗標）。設定頁以它顯示「已同步」                                |
| `aaguid`      | 字串；設定頁以它對照提供者名稱                                                 |
| `rp_id`       | 從 KV 匯入的舊憑證為 NULL，第一次登入時補上                                    |

從 KV 匯入的舊憑證也是 SimpleWebAuthn 產生的 base64url 公鑰〔查證：`src/services/legacyImport.ts` 的 `StoredCredential`〕。所以任何替代方案都要能讀 COSE_Key，或先轉換格式。

---

## 3. 安全公告與本專案的影響

| 公告                | 等級     | 內容                                                                                      | 列出的受影響版本 | 修正版本 |
| ------------------- | -------- | ----------------------------------------------------------------------------------------- | ---------------- | -------- |
| GHSA-6hxq-p678-4hr2 | Low      | `validateCertificatePath()` 遇到第一張自簽憑證就停止，沒有確認憑證鏈接到設定的信任錨      | `<= 13.3.1`      | 13.3.2   |
| GHSA-j3h4-m3m2-7p7j | Moderate | 驗證憑證鏈之前，先下載攻擊者憑證中的 CRL 網址（blind SSRF）                               | `14.0.1`         | 14.0.2   |
| GHSA-2g3p-m8c9-hhwh | Moderate | 下載的 CRL 沒有驗證簽章，就以攻擊者憑證的 Authority Key Identifier 存入整個程序共用的快取 | `14.0.1`         | 14.0.2   |

〔查證：`gh api /repos/MasterKale/SimpleWebAuthn/security-advisories`、`CHANGELOG.md`〕

- **13.2.2 有同樣的程式路徑。** `validateCertificatePath.js` 先對每張 x5c 憑證呼叫 `assertCertNotRevoked()`，之後才驗證憑證鏈；`isCertRevoked.js` 以 `fetch(crlURL)` 下載 CRL，沒有驗證簽章就存入模組層級的 `cacheRevokedCerts`；自簽憑證的 `break` 也在〔查證：13.2.2 原始碼〕。`android-key` 格式以 x5c 自己的最後一張憑證當信任錨呼叫這個函式，之後才比對 Google 根憑證〔查證：`verifyAttestationAndroidKey.js` 第 93、104 行〕。所以兩個 Moderate 公告的版本範圍只寫 14.0.1，但 13.2.2 同樣受影響〔推論〕。
- **本專案的暴露：**
  - 觸發條件是送出帶 x5c 的註冊回應。`/api/webauthn/register/*` 需要 `authMiddleware` 與 `recentAuthMiddleware`〔查證：`src/routes/webauthn.ts`〕。只有 10 分鐘內驗證過的管理者可以觸發。
  - SSRF：Worker 的 `fetch()` 只能連到公開網路；`wrangler.toml` 沒有 VPC 或 Tunnel 綁定〔推論〕。
  - CRL 快取污染：影響同一個 isolate 之後帶 x5c 的註冊，最多讓合法的註冊被判為撤銷。本專案不依 attestation 結果做信任決定（`aaguid` 只用於顯示名稱），所以 GHSA-6hxq 也沒有實際影響〔推論〕。
- 結論：維持 13.2.2 的安全風險低，但無法取得之後的修正。

---

## 4. 伺服器端候選套件

### 4.1 比較表

| 項目                   | `@simplewebauthn/server` 14.0.3              | `@passwordless-id/webauthn` 2.4.0              | `@oslojs/webauthn` 1.0.0（+ `@oslojs/crypto`）                 | `fido2-lib` 3.5.9                                                      |
| ---------------------- | -------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 最後發布               | 2026-09-25                                   | 2026-05-15                                     | 2024-09-19；2026-07-29 被標為不再支援                          | 2026-03-11                                                             |
| GitHub                 | 2357 stars，6 個 open issue                  | 612 stars，1 個 open issue，沒有公開的安全公告 | 最後 push 2024-09-22                                           | 445 stars，26 個 open issue                                            |
| 相依                   | `@peculiar/x509`、9 個 `@peculiar/asn1-*` 等 | 無                                             | `@oslojs/asn1`、`cbor`、`binary`、`crypto`、`encoding`         | `@peculiar/webcrypto`、`pkijs`、`asn1js`、`cbor-x`、`jose`、`tldts` 等 |
| workerd                | 可執行〔實測〕                               | 可執行〔實測〕                                 | 可執行〔實測〕                                                 | 靜態匯入 Node `crypto`；issue #135 未解〔查證〕；未實測                |
| 打包大小（spike）      | 624 kB（gzip 129 kB）                        | 59 kB（gzip 20 kB），含 AAGUID 對照表          | 129 kB（gzip 28 kB）                                           | 未實測                                                                 |
| 產生 options           | 有                                           | 沒有（伺服器端）                               | 沒有                                                           | 有                                                                     |
| 驗證 challenge、origin | 有                                           | 有                                             | 沒有，要自己寫                                                 | 有                                                                     |
| 演算法                 | EdDSA、ES256、RS256 等                       | ES256、RS256；**不支援 EdDSA**                 | 解析 EC2、RSA、OKP；簽章由 `@oslojs/crypto` 或 Web Crypto 驗證 | 未查證                                                                 |
| Attestation 驗證       | 全部格式                                     | 不驗證                                         | 只解析                                                         | 有                                                                     |
| 讀 COSE_Key（D1 格式） | 可以                                         | 不行，要 SPKI；可以轉換（第 4.2 節）           | 可以，但 `decodeCOSEPublicKey` 要深層匯入                      | 未查證                                                                 |
| 3000 次登入驗證        | 3000 成功                                    | **2976 成功、24 失敗**                         | 3000 成功                                                      | 未實測                                                                 |
| 改寫範圍               | 約 5 行                                      | 約 150–250 行，5 個檔案                        | 約 150–250 行，5 個檔案                                        | 未估算                                                                 |

〔查證：`npm view`、`gh api repos/<repo>`〕〔實測：第 4.5 節〕

### 4.2 `@passwordless-id/webauthn`

- 伺服器端的 `verifyRegistration()` 讀瀏覽器 JSON 中的 `response.publicKey`（SPKI）、`response.publicKeyAlgorithm`、`response.authenticatorData`，不讀 `attestationObject`〔查證：`dist/esm/server.js`、`parsers.js`〕。none attestation 下兩者都由瀏覽器提供，安全性相同〔推論〕。這三個欄位需要 `getPublicKey()` 等方法：Chrome 85、Safari 16、Firefox 119 以上〔查證：MDN BCD〕。
- **ES256 簽章轉換錯誤。** `convertASN1toRaw()` 假設 DER 中的 r 是 32 或 33 位元組。r 或 s 的最高位元組為 0 時，DER 整數只有 31 位元組，轉換結果錯誤，驗證失敗〔查證：`src/server.ts` 第 229–238 行，main 分支仍然如此〕。每個簽章發生的機率約 2/256〔推論〕。實測 3000 次中 24 次失敗，失敗的 24 次正是短整數的簽章〔實測〕。使用者會偶爾看到「passkey 驗證失敗」，重試後成功。
- `getAlgoParams()` 只接受 `'RS256'`、`'ES256'`，EdDSA 丟出錯誤〔查證〕。D1 中如果有 EdDSA 憑證，這些憑證無法登入。
- `toRegistrationInfo()` 的 `synced` 是 BE 旗標，不是 BS 旗標；`toAuthenticationInfo()` 沒有回傳 BE／BS〔查證〕。本專案要自己用 `parsers.parseAuthenticator()` 讀 BS。
- 既有憑證：D1 的 COSE_Key 可以用 Web Crypto 轉成 SPKI（JWK 匯入後以 `spki` 匯出），轉換結果與瀏覽器提供的 SPKI 相同〔實測：P-256〕。RSA 的轉換沒有測試。
- 要自己寫：options 產生、COSE→SPKI 轉換、簽章轉換的修正（或 fork）、`src/test/authenticator.ts` 的 CBOR 編碼。

### 4.3 `@oslojs/webauthn`

- 作者在 2026-07-29 宣布停止維護 Oslo 的大多數套件，只繼續維護 `@oslojs/encoding`〔查證：pilcrowonpaper.com/blog/18〕。npm 上 `@oslojs/webauthn`、`cbor`、`crypto`、`asn1`、`binary` 都標為「Package no longer supported」〔查證：`npm view <pkg> deprecated`〕。
- 套件只提供解析：`parseAttestationObject()`、`parseAuthenticatorData()`、`parseClientDataJSON()`、`createAssertionSignatureMessage()`、COSE 公鑰。challenge、origin、type、UP／UV 旗標、counter、簽章驗證都要自己寫〔查證：`dist/index.d.ts`〕。
- 在 spike 中讀 COSE_Key、驗證 3000 次簽章全部成功；`@oslojs/crypto` 的 ECDSA 是純 JS，3000 次（含軟體驗證器簽章）用 4229 ms，SimpleWebAuthn 用約 220 ms〔實測〕。每次登入約 1.4 ms，在 Workers 的 CPU 限制內〔推論〕。
- 結論：停止維護，而且安全檢查要自己寫。不建議。

### 4.4 `fido2-lib`

- `lib/toolbox.js` 靜態匯入 `crypto` 與 `@peculiar/webcrypto`，執行時才判斷用 `self.crypto`〔查證〕。打包器仍會把兩者打包進 Worker〔推論〕。
- 相依 `pkijs`、`asn1js`，與 `@peculiar/*` 屬於同一類 ASN.1 套件。第 6 節的多副本問題在這裡也可能發生〔推論〕。
- issue #135「Usage in edge environments - Cloudflare workers」從 2023-08-13 開啟至今〔查證〕。
- 因以上原因沒有做 spike。

### 4.5 其他套件與 spike 結果

- `@open-passkey/server` 0.1.4：2026-04 建立，0.x 版本〔查證：`npm view`〕。不評估。
- `webauthn-server-buildkit` 2.3.2：`engines.node >= 24.13.0`，為 Node 設計〔查證〕。不評估。
- 自己用 Web Crypto 實作：本專案只用 none attestation，驗證只需要 CBOR 解碼、rpIdHash、旗標、ES256／RS256／Ed25519 簽章。程式量與 `@oslojs/webauthn` 方案相近，但沒有外部審查〔推論〕。不建議。

Spike〔實測〕：`webauthn-alt/spike/`。軟體驗證器產生 P-256 金鑰與 none attestation，簽章以 DER 輸出，與真實驗證器相同。每個變體執行 `vite build` 後以 `vite preview` 啟動，在 workerd 中完成 1 次註冊與 3000 次登入驗證。

| 變體                              | 啟動 | 註冊 | 3000 次登入 | 短整數簽章數   | X.509 解析（Apple 根憑證） |
| --------------------------------- | ---- | ---- | ----------- | -------------- | -------------------------- |
| `@simplewebauthn/server` 13.2.2   | 成功 | 成功 | 3000 成功   | 14             | 成功                       |
| `@simplewebauthn/server` 14.0.3   | 成功 | 成功 | 3000 成功   | 24             | 成功                       |
| `@passwordless-id/webauthn` 2.4.0 | 成功 | 成功 | 2976 成功   | 24（全部失敗） | —                          |
| `@oslojs/webauthn` 1.0.0          | 成功 | 成功 | 3000 成功   | 19             | —                          |

另外，14.0.3 在 workerd 中產生的 `pubKeyCredParams` 是 `[-8, -7, -257]`，沒有 ML-DSA〔實測〕。

---

## 5. 瀏覽器端：原生 JSON 方法與 `@simplewebauthn/browser`

| 功能                                       | Chrome | Safari／iOS | Firefox |
| ------------------------------------------ | ------ | ----------- | ------- |
| `parseCreationOptionsFromJSON()`           | 129    | 18.4        | 119     |
| `parseRequestOptionsFromJSON()`            | 129    | 18.4        | 119     |
| `PublicKeyCredential.toJSON()`             | 129    | 18.4        | 119     |
| `isConditionalMediationAvailable()`        | 108    | 16          | 119     |
| `getPublicKey()`、`getAuthenticatorData()` | 85     | 16          | 119     |

〔查證：`@mdn/browser-compat-data` 8.1.3；Safari 18.4 由 WebKit 部落格「WebKit Features in Safari 18.4」（2025-03-31）確認〕

- 改用原生方法時，iOS 18.4 以前的裝置無法使用 passkey，除非保留 polyfill。
- 原生方法不處理：同一頁面兩個請求的互相取消（要自己用 `AbortController`）、`autocomplete="… webauthn"` 的檢查、`mediation: 'conditional'` 的設定。本專案三處呼叫共約 20–40 行〔推論〕。
- `@simplewebauthn/browser` 13.2.2 自己做 base64url 轉換，沒有使用原生 JSON 方法〔查證：原始碼〕；沒有相依；不在 Worker 中執行。它和 issue #9 無關。
- 結論：保留 `@simplewebauthn/browser`，與伺服器端一起升級到 14.0.0。14.0.0 對瀏覽器端沒有 breaking change（最低版本的變更只針對 Node 與 Deno）〔查證：`CHANGELOG.md`〕。

---

## 6. 升級 SimpleWebAuthn：啟動失敗的重現與修正

### 6.1 重現

在 `origin/main` 的複本中把版本改為 14.0.3／14.0.0，保留 `bun.lock`，執行 `bun install`〔實測〕：

- `node_modules/@peculiar/asn1-schema` 是 2.6.0（lock 中的舊版本）。另有 13 份 2.9.5，位於各個 `@peculiar/asn1-*/node_modules/` 與 `@peculiar/x509/node_modules/` 下。`asn1js` 也有 12 份 3.0.10。
- 打包結果中有 2 個 `class AlgorithmIdentifier`。
- `vite preview`：`Uncaught Error: Cannot get schema for 'AlgorithmIdentifier' target`，堆疊為 `get` → `toASN` → `serialize`，位置在 `@peculiar/asn1-rsa/build/es2015/algorithms.js` 的模組頂層（`new AlgorithmIdentifier({ parameters: AsnConvert.serialize(sha1) })`）。

`@peculiar/asn1-schema` 以模組層級的 `schemaStorage` 記錄 decorator 註冊的 schema〔推論：由錯誤訊息與打包結果中的 `storage.js` 區段推得〕。`asn1-x509` 在自己那一份註冊 `AlgorithmIdentifier`，`asn1-rsa` 從另一份讀取，所以找不到。

### 6.2 修正

刪除 `bun.lock` 與 `node_modules` 後重新 `bun install`〔實測〕：

- `@peculiar/asn1-schema` 與 `asn1js` 各只有 1 份（2.9.5、3.0.10），`@peculiar/x509` 為 2.1.0。
- 打包結果中只有 1 個 `class AlgorithmIdentifier`。Worker 正常啟動：`GET /` 200，`POST /api/webauthn/authenticate/options` 200 並回傳 options。
- `tsc`：1 個錯誤，`src/services/passkey.ts(156,5)`，`string[]` 不能指定給 `AuthenticatorTransport[]`（`AuthenticatorTransportFuture` 已先改名）。
- `bun test`：52 個測試通過。

刪除整個 lock 會一起更新其他相依。只重新解析 `@peculiar/*` 與 `asn1js` 的做法（例如 `bun update` 指定套件，或 `package.json` 的 `overrides`）沒有測試。

### 6.3 防止再次發生

- 在 `bun run check` 加一項檢查：`find node_modules -path '*@peculiar/asn1-schema/package.json'` 只能有 1 筆。
- `AGENTS.md` 已要求以 `bun run preview` 驗證 SimpleWebAuthn 升級。這項要求要保留。

---

## 7. 三個做法的比較

| 項目        | A. 升級並重新解析 lock                 | B. 更換套件（最佳候選 `@passwordless-id/webauthn`）    | C. 維持 13.2.2                     |
| ----------- | -------------------------------------- | ------------------------------------------------------ | ---------------------------------- |
| 安全修正    | 取得 13.3.2、14.0.2 的修正與之後的修正 | 沒有 x509／CRL 程式碼，這三個公告不適用                | 沒有；風險低（第 3 節）            |
| Worker 啟動 | 正常〔實測〕                           | 正常〔實測〕                                           | 正常                               |
| 程式變更    | 約 5 行，另加 lock 與檢查              | 約 150–250 行，5 個檔案，另加簽章轉換的修正            | 無                                 |
| D1 憑證     | 不變                                   | COSE→SPKI 轉換；EdDSA 憑證無法登入                     | 不變                               |
| 新的風險    | lock 再次分裂（有檢查時可以提早發現）  | 約 0.8% 登入失敗（未修正時）；要自己維護安全相關程式碼 | 無法取得之後的修正；依賴會越來越舊 |
| 維護        | 活躍，發布到 2026-09-25                | 最後發布 2026-05-15，專案較小                          | —                                  |

選 A。B 移除了 `@peculiar/*`，但加入一個已知的驗證錯誤，並失去 EdDSA 支援與 attestation 驗證。C 目前可以接受，但沒有理由繼續等：A 的成本已經很低。

---

## 8. 未解問題

- bun 為什麼沒有把 2.9.5 提升到頂層，而是複製 13 份：沒有調查。可能與 lock 中保留的頂層 2.6.0 有關〔推論〕。
- issue #9 寫「只留一份 2.9.5 仍然失敗」：當時的 `node_modules` 狀態查不到，無法比對。
- 真實驗證器（iCloud 鑰匙圈、Google 密碼管理工具、1Password、Bitwarden、安全金鑰）在 14.0.3 下的註冊與登入：沒有測試。
- 正式 D1 中 EdDSA、RS256 憑證的數量：查不到。
- `overrides` 或只更新 `@peculiar/*` 是否也能得到單一副本：沒有測試。

---

## 9. 來源

### 套件與 npm metadata（2026-09-26）

- `npm view @simplewebauthn/server@{13.2.2,13.2.3,13.3.0,13.3.2,13.3.3,14.0.3} dependencies`、`time`
- `npm view @passwordless-id/webauthn`、`@oslojs/{webauthn,cbor,crypto,asn1,binary,encoding}`、`fido2-lib`、`@open-passkey/server`、`webauthn-server-buildkit`、`@github/webauthn-json`
- 原始碼（`npm pack`）：`@simplewebauthn/server` 13.2.2（`helpers/validateCertificatePath.js`、`helpers/isCertRevoked.js`、`registration/verifyRegistrationResponse.js`、`registration/verifications/verifyAttestationAndroidKey.js`、`registration/generateRegistrationOptions.js`）、14.0.3；`@simplewebauthn/browser` 13.2.2（`methods/startAuthentication.js`、`helpers/webAuthnAbortService.js`、`helpers/webAuthnError.js`）；`@passwordless-id/webauthn` 2.4.0（`dist/esm/server.js`、`parsers.js`）；`@oslojs/webauthn` 1.0.0（`dist/*.d.ts`）；`fido2-lib` 3.5.9（`lib/toolbox.js`）
- `@mdn/browser-compat-data` 8.1.3（`api.PublicKeyCredential`、`api.AuthenticatorAttestationResponse`）

### GitHub

- SimpleWebAuthn advisories：https://github.com/MasterKale/SimpleWebAuthn/security/advisories （GHSA-6hxq-p678-4hr2、GHSA-j3h4-m3m2-7p7j、GHSA-2g3p-m8c9-hhwh）
- SimpleWebAuthn `CHANGELOG.md`：https://github.com/MasterKale/SimpleWebAuthn/blob/master/CHANGELOG.md
- passwordless-id `src/server.ts`：https://github.com/passwordless-id/webauthn/blob/main/src/server.ts
- fido2-lib issue #135：https://github.com/webauthn-open-source/fido2-lib/issues/135
- oslo-project/webauthn：https://github.com/oslo-project/webauthn
- `gh issue view 9`（本 repo）

### 其他文件

- 「I am deprecating most of my open-source NPM package」（2026-07-29）：https://pilcrowonpaper.com/blog/18
- WebKit Features in Safari 18.4（2025-03-31）：https://webkit.org/blog/16574/webkit-features-in-safari-18-4/

### 本 repo（`origin/main`）

- `src/services/passkey.ts`、`src/routes/webauthn.ts`、`src/db/passkeys.ts`、`src/test/authenticator.ts`、`src/services/legacyImport.ts`、`src/client/login/index.ts`、`src/client/settings/{Account.tsx,reauth.ts,Passkeys.tsx}`、`src/client/shared/api.ts`、`src/pages/Login.tsx`、`migrations/0001_init.sql`、`package.json`、`bun.lock`、`wrangler.toml`、`AGENTS.md`、`docs/research/2026-09-26-toolchain-upgrade.md`

### 實測（scratchpad `webauthn-alt/`）

- `spike/`：Vite 8.3.1、`@cloudflare/vite-plugin` 1.60.2、wrangler 4.141.0。變體 `swa13`、`swa14`、`swa14opts`、`pid`、`oslo`，各自 `vite build` 後 `vite preview`（port 4190–4195）。
- `app14/`：`origin/main` 的複本升級到 14.0.3／14.0.0；保留 lock 與重新解析 lock 兩種狀態下的 `bun install`、`bun run build`、`vite preview`（port 4194）、`tsc --noEmit`、`bun test`、`wrangler d1 migrations apply DB --local`。
