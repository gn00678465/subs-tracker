# Passkey 設定頁研究：成熟產品的做法與本 repo 的建議

- 查核日期：2026-09-26
- 範圍：設定頁 WebAuthn 分頁（`src/pages/Config.tsx:417-662`）的每個選項、已註冊 passkey 清單、新增與刪除 passkey 前的重新驗證、RP ID 與 origin 的來源、`/.well-known/webauthn`。本 repo 只有一位管理員，部署在 Cloudflare Workers，使用 `@simplewebauthn/server` 13.2.2。
- 驗證方法：
  - 規格：W3C WebAuthn Level 3。這份規格在 2026-08-25 成為 W3C Recommendation（https://www.w3.org/TR/webauthn-3/ 的標頭）。
  - 函式庫：讀取本 repo `node_modules/@simplewebauthn/server`（13.2.2）的原始碼，並對照 https://simplewebauthn.dev/docs/packages/server （網站目前顯示 14.0.x 文件）。
  - 開源專案：在 scratchpad 目錄 shallow clone 下列 repo 並閱讀原始碼。連結都固定在當天的 commit。
    - Pocket ID `261003668eff0a37dc02b1bb887f603db007ad7d`
    - Gitea `f0f53a76ee9454f158d480cc16ec85ee72366f60`
    - Nextcloud server `acf50d9e58118145729de8cfba3e1411dda59ac7`
    - authentik `cd72bc3af1895e81d5b3cf97696f5be568c8139d`
    - Vaultwarden `061694d0cb3bbf5d4c7e920c892824f0020cff83`
    - Kanidm `6e8d9f133c6af0b3b98650e7df1b0bafe5224bd4`
  - `psl` 的行為：在本 repo 以 `node -e` 執行 `psl.get()`（`psl` 1.15.0）。
  - 本 repo 的檔案沒有變更，只新增本文。本文引用的本 repo 行號以 commit `d5faae3` 為準。
- 標記：每一項主張後面標示〔查證〕或〔推論〕。〔查證〕表示已經讀過所列的來源。〔推論〕表示由查證的事實推出、但沒有實測的結論。

---

## 1. 摘要與建議

### 1.1 最重要的發現

1. **設定頁的 10 個 WebAuthn 選項中，有 2 個完全沒有作用，1 個會造成登入失敗。**
   - `WEBAUTHN_ENABLED` 只有存取，沒有任何路由讀取。停用後仍然可以註冊與登入 passkey。〔查證：`src/routes/webauthn.ts` 全檔沒有讀取這個值；`grep WEBAUTHN_ENABLED src` 只出現在型別、設定服務、設定頁與設定路由〕
   - `WEBAUTHN_HINTS` 只有存取，沒有傳給 `generateRegistrationOptions()` 或 `generateAuthenticationOptions()`。〔查證：`src/routes/webauthn.ts:84-100`、`266-274`〕
   - `WEBAUTHN_USER_VERIFICATION` 設為 `discouraged` 時，瀏覽器不會要求 PIN，但伺服器驗證時仍然要求 UV 旗標，所以沒有 PIN 的安全金鑰會驗證失敗。原因：`verifyRegistrationResponse()` 與 `verifyAuthenticationResponse()` 的 `requireUserVerification` 預設是 `true`，本 repo 沒有傳入這個參數。〔查證：`node_modules/@simplewebauthn/server/esm/registration/verifyRegistrationResponse.js:35,118`、`esm/authentication/verifyAuthenticationResponse.js:24,137`、`src/routes/webauthn.ts:177-182,357-367`〕
2. **沒有填 RP ID 時，程式用「可註冊網域」當 RP ID，並用瀏覽器送來的 `Origin` 標頭當預期 origin。** 在 workers.dev 上，`subs-tracker.<帳號>.workers.dev` 的 RP ID 會變成 `<帳號>.workers.dev`。這個 RP ID 涵蓋同一個 Cloudflare 帳號下的所有 Worker。〔查證：`src/services/webauthn.ts:222-238`、`src/routes/webauthn.ts:167-175`；`psl.get('subs-tracker.madao.workers.dev')` 回傳 `madao.workers.dev`〕規格要求 RP 預設不接受子網域 origin，也不能接受非預期的 origin（WebAuthn L3 §13.4.8、§13.4.9）。〔查證〕
3. **沒有一個被查的開源專案把 WebAuthn 協定參數開放給一般使用者。** RP ID 與 origin 都來自伺服器設定的網址或請求的 Host。只有多使用者的身分提供者（Pocket ID、authentik）把少數政策選項開放給管理員。〔查證：見第 3 節〕
4. **所有被查的產品都在清單上顯示名稱與建立時間，Google 的指引另外要求顯示最後使用時間、提供者名稱與同步狀態。** 本 repo 已經儲存建立時間與最後使用時間，但沒有儲存 AAGUID，也沒有在登入後更新 `backedUp`。〔查證：https://web.dev/articles/passkey-management ；`src/types/webauthn.ts:6-17`；`src/services/webauthn.ts:105-137`〕
5. **passkey 的索引 key 包含管理員帳號名稱。** 修改 `ADMIN_USERNAME` 後，已註冊的 passkey 從清單消失，也不能登入。〔查證：`src/services/webauthn.ts:26,60`、`src/routes/webauthn.ts:257`〕

### 1.2 建議做法（詳細內容見第 7 節）

- WebAuthn 分頁只保留「Passkey」清單與「新增 passkey」按鈕。移除全部 10 個設定欄位。
- RP ID 改為目前請求的完整主機名稱（`new URL(c.req.url).hostname`），預期 origin 改為 `new URL(c.req.url).origin`。每筆憑證記錄註冊時的 RP ID。
- 協定參數固定在程式內：`attestation: 'none'`、`residentKey: 'preferred'`、`userVerification: 'required'`、`timeout: 300000`，不設 `authenticatorAttachment` 與 hints。
- 清單每筆顯示：名稱（預設用 AAGUID 對應的提供者名稱）、建立時間、最後使用時間、「已同步」或「僅限此裝置」。
- 新增與刪除 passkey 前，要求最近 10 分鐘內驗證過密碼或 passkey。改名不需要。
- 密碼登入一直保留。刪除最後一個 passkey 時提示「之後只能用密碼登入」。

---

## 2. 設計指引（第一方來源）

### 2.1 Google（web.dev / developers.google.com）

`https://web.dev/articles/passkey-management`（〔查證〕）：

- 名稱：「Display the passkey name which was given at the time of registration. Ideally this name matches the passkey provider it was created on based on the AAGUID.」
- 提供者圖示：「Display the passkey provider logo.」
- 時間：「Recording and displaying the passkey creation timestamp and last usage timestamp can also help the user identify the passkey they want to manage.」
- 同步狀態：顯示 passkey 不能同步，可以減少使用者的困惑。
- 操作：每筆提供刪除與編輯（改名）按鈕。
- 刪除最後一個 passkey：「make sure they understand that they will have to sign in with another option.」
- 刪除後用 Signal API 通知 passkey 提供者。
- 「don't let them add more than one passkey for the same account with the same provider.」（也就是使用 `excludeCredentials`）

`https://web.dev/articles/passkey-registration`（〔查證〕）：

- 建立 passkey 前，使用者要在「a meaningfully short window」內完成驗證。文件警告只用密碼驗證有風險，因為密碼可能已經外洩。
- `user.id` 要固定不變，不能是可以修改的帳號名稱，也不能包含個人資料。
- 要儲存的資料：credential ID、公鑰、建立時間、最後使用時間、AAGUID、備份資格旗標。
- 註冊 passkey 後，寄出通知（例如 email），讓使用者發現未經授權的註冊。

`https://developers.google.com/identity/passkeys/ux/user-interface-design`（〔查證〕）：帳號設定用「passkey 卡片」呈現，每張卡片包含 passkey 圖示、建立時間與建立的生態系、最後使用時間與管理操作。

`https://developer.chrome.com/docs/identity/webauthn-signal-api`（〔查證〕）：

- `signalAllAcceptedCredentials`：使用者刪除 passkey 後，或使用者登入後呼叫。
- `signalUnknownCredential`：passkey 登入因為伺服器找不到憑證而失敗時呼叫。
- 支援：Chrome 132+、Edge 132+。

### 2.2 FIDO Alliance 設計指引

`https://www.passkeycentral.org/design-guidelines/required-patterns/create-view-and-manage-passkeys-in-account-settings`（`fidoalliance.org/design-guidelines/` 以 301 轉址到這裡）（〔查證〕）：

- 這是「Required Pattern」。沒有 passkey 時，在帳號設定頂端放建立 passkey 的提示。
- 有 passkey 時：「allow them to see it as a card. One card per passkey」、「place the passkeys UI above passwords in the interface」、「offer the ability to remove them」。
- 頁面沒有規定卡片的欄位、改名或重新驗證流程。

### 2.3 Apple

`https://developer.apple.com/documentation/authenticationservices/supporting-passkeys`（以文件 JSON `https://developer.apple.com/tutorials/data/documentation/authenticationservices/supporting-passkeys.json` 讀取）（〔查證〕）：

- 「Registering a passkey with the same user ID as an existing one overwrites the existing passkey on the user’s devices.」
- Apple 文件沒有帳號設定頁的 UI 指引。

### 2.4 規格中與 UI 有關的條文（WebAuthn L3）

- §15：「Relying Parties, at registration time, SHOULD provide affordances for users to complete future authorization gestures correctly. This could involve naming the authenticator…」〔查證〕
- §14.6.1：user handle 不能包含帳號名稱或 email；「It is RECOMMENDED to let the user handle be 64 random bytes, and store this value in the user account.」〔查證〕

---

## 3. 開源自架專案的實作

| 專案        | passkey 用途                  | RP ID 來源                                        | 開放給管理員的選項                                                      | 固定在程式內的選項                                                        | 清單欄位                                                    | 新增／刪除前重新驗證 |
| ----------- | ----------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------- |
| Pocket ID   | 唯一的登入方式（OIDC 提供者） | `APP_URL` 的完整主機名稱                          | UV（required／preferred）、允許同步 passkey、authenticator attachment   | residentKey `required`、timeout 60 秒、RP 名稱 = 應用程式名稱             | 名稱（預設由 AAGUID 產生）、提供者圖示、新增日期            | 沒有                 |
| Gitea       | 無密碼登入與第二因素          | `DOMAIN` 設定；origin = `ROOT_URL`                | `ENABLE_PASSKEY_AUTHENTICATION`（ini，預設 `true`）                     | attestation `none`、residentKey `required`、UV `required`                 | 名稱、新增日期                                              | 沒有                 |
| Nextcloud   | 無密碼登入                    | 請求的 server host（去掉 port）                   | `auth.webauthn.enabled`（config.php，預設 `true`）                      | attestation `none`、attachment 不限、註冊 UV `preferred`、timeout 60 秒   | 名稱                                                        | 有：確認密碼         |
| authentik   | 驗證流程中的一個 stage        | 請求的 Host（去掉 port）                          | UV、residentKey、attachment、hints、裝置類型限制（每個 stage 各自設定） | attestation `direct`                                                      | 儲存名稱、建立時間、最後使用時間、AAGUID、裝置類型；UI 未查 | 依流程設定（未查）   |
| Vaultwarden | 只當第二因素                  | `DOMAIN` 設定                                     | 沒有                                                                    | timeout 60 秒、RP 名稱 = `DOMAIN`                                         | 名稱                                                        | 有：主密碼           |
| Kanidm      | 主要登入方式                  | 伺服器設定的 `domain`，啟動時檢查與 `origin` 相符 | 沒有                                                                    | 由 `webauthn-rs` 的 `start_passkey_registration` 決定，呼叫端不傳協定參數 | （未查）                                                    | （未查）             |

各欄位的來源：

- **Pocket ID**〔查證〕
  - RP ID 與 origin：`backend/internal/webauthn/service.go:39-60` 用 `utils.GetHostnameFromURL(deps.AppURL)` 當 RP ID，用 `[]string{deps.AppURL}` 當 origin。https://github.com/pocket-id/pocket-id/blob/261003668eff0a37dc02b1bb887f603db007ad7d/backend/internal/webauthn/service.go#L39-L60
  - 註冊選項：同檔 `:94-101` 固定 `ResidentKeyRequirementRequired`，attachment 與 UV 來自管理員設定。
  - 管理員選項與預設值：`backend/internal/appconfig/model.go:65-67,171-173`（UV 預設 `required`、允許同步 passkey 預設 `true`、attachment 預設 `any`）。
  - UI 文字：`frontend/messages/en.json:125`「Require biometric or PIN verification. Passkeys that cannot verify the user will not work.」；`:129`「Allow new passkeys that can be backed up and used across multiple devices.」
  - 名稱由 AAGUID 產生：`service.go:184-186,218-222`；儲存 `BackupEligible`、`BackupState`、`AAGUID`：`backend/internal/model/webauthn.go`。
  - 清單：`frontend/src/routes/settings/account/passkey-list.svelte` 顯示名稱、「added on」日期、提供者圖示，刪除前開確認對話框，另有改名對話框。
  - 刪除與改名：`backend/internal/webauthn/module.go:91-93` 的清單、改名、刪除路由只掛 `userAuth`；`service.go:341-357` 的 `DeleteCredential` 沒有「最後一個 passkey」的檢查。重新驗證 token 由 OIDC 模組使用（`module.go:98-100`）。
- **Gitea**〔查證〕
  - `modules/auth/webauthn/webauthn.go:23-36`：`RPID: setting.AppDomain`、`RPOrigins: []string{appURL}`、`AttestationPreference: protocol.PreferNoAttestation`，註解寫「Gitea never verifies attestation」。https://github.com/go-gitea/gitea/blob/f0f53a76ee9454f158d480cc16ec85ee72366f60/modules/auth/webauthn/webauthn.go#L23-L36
  - `routers/web/user/setting/security/webauthn.go:65-69`：固定 `ResidentKey: Required` 與 `UserVerification: Required`，註解說明其他值會讓 Chromium 把 credProtect 提高到 level 3。
  - `modules/setting/service.go:181`：`ENABLE_PASSKEY_AUTHENTICATION` 預設 `true`。
  - `templates/user/settings/security/webauthn.tmpl`：清單顯示名稱與「added on」；註冊前要填名稱；刪除前開確認對話框；沒有改名。`models/auth/webauthn.go:53` 儲存 AAGUID，但清單不顯示。
  - `options/locale/locale_en-US.json:912-914`：「If you lose your security keys, you will lose access to your account.」「You may want to configure an additional authentication method.」
- **Nextcloud**〔查證〕
  - `lib/private/Authentication/WebAuthn/Manager.php:50-92`：RP ID = `stripPort($serverHost)`；attachment 不限；UV `preferred`；attestation `none`；timeout 60000。https://github.com/nextcloud/server/blob/acf50d9e58118145729de8cfba3e1411dda59ac7/lib/private/Authentication/WebAuthn/Manager.php#L50-L92
  - 同檔 `:148-160`：登入時，如果所有憑證都有 UV，就要求 UV；否則改為 `discouraged`。
  - 同檔 `:234-240`：`auth.webauthn.enabled` 預設 `true`。
  - `apps/settings/lib/Controller/WebAuthnController.php`：`startRegistration`、`finishRegistration`、`deleteRegistration` 都標註 `#[PasswordConfirmationRequired]`。
  - `apps/settings/src/components/WebAuthn/WebAuthnDevice.vue`：每筆只顯示名稱（沒有名稱時顯示「Unnamed device」）與刪除。
- **authentik**〔查證〕
  - `authentik/stages/authenticator_webauthn/models.py:93-112`：`user_verification`（預設 `preferred`）、`resident_key_requirement`（預設 `preferred`）、`authenticator_attachment`（預設不限）、`hints`、`device_type_restrictions`。
  - 同檔 `:154-170`：每筆憑證儲存 `name`、`rp_id`、`created_on`、`last_t`（最後使用）、`aaguid`、`device_type`。
  - `authentik/stages/authenticator_webauthn/utils.py`：RP ID 取自 `request.get_host()`，去掉 port。
  - `stage.py:184`：attestation 固定 `DIRECT`，用於裝置類型限制。
- **Vaultwarden**〔查證〕
  - `src/api/core/two_factor/webauthn.rs:33-44`：RP ID 取自 `DOMAIN` 設定，timeout 固定 1 分鐘。
  - 同檔 `:111-136`：讀取清單與產生註冊 challenge 前，驗證主密碼或 OTP（`PasswordOrOtpData`）；`:319-321`：刪除前檢查主密碼。
- **Kanidm**〔查證〕
  - `server/lib/src/idm/server.rs:170-203`：RP ID 是伺服器的 domain name。啟動時檢查 origin 的網域等於 RP ID 或是它的子網域，不相符就拒絕啟動。
  - `server/lib/src/idm/credupdatesession.rs:2483`：呼叫 `start_passkey_registration(uuid, spn, displayname, …)`，沒有傳入 UV、residentKey 或 attestation。

歸納：

- 單一使用者或小型自架應用（Gitea、Nextcloud、Vaultwarden、Kanidm）不開放協定參數。〔查證〕
- 開放選項的兩個專案都是多使用者的身分提供者，選項是組織政策（例如禁止同步 passkey、只允許安全金鑰），不是除錯用的協定開關。〔查證：Pocket ID、authentik 的欄位〕本 repo 只有一位管理員，沒有這種政策需求。〔推論〕

---

## 4. 託管產品

- **GitHub**〔查證：https://docs.github.com/en/authentication/authenticating-with-a-passkey/managing-your-passkeys 、https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/sudo-mode 〕
  - 新增 passkey 時：「If prompted, authenticate with your password, or use another existing authentication method.」
  - 同步 passkey 的名稱旁邊顯示藍色「Synced」標籤。
  - 建議裝置綁定的 passkey 至少在兩台裝置上註冊。
  - sudo mode：高影響操作前要求驗證，有效 2 小時。可用 passkey、安全金鑰、GitHub Mobile、2FA 代碼或密碼。
- **Google 帳戶**〔查證：https://support.google.com/accounts/answer/13548313 〕
  - 刪除路徑：Google Account → Security & sign-in → Passkeys and security keys → 選擇 passkey → Remove。
  - 建立 passkey 後，密碼仍然可以登入。使用者可以關閉「Skip password when possible」，讓密碼成為預設登入方式。
- 兩者都沒有把 WebAuthn 協定參數開放給使用者。〔查證：上述文件都沒有這類設定〕

---

## 5. 逐項分析本 repo 的設定

「規格預設」來自 WebAuthn L3 的 IDL（https://www.w3.org/TR/webauthn-3/ ）。「函式庫預設」來自 `node_modules/@simplewebauthn/server/esm/registration/generateRegistrationOptions.js` 與 `esm/authentication/generateAuthenticationOptions.js`（13.2.2）。

| 設定                                | 規格預設                                 | 函式庫預設與建議                                                               | 成熟應用是否開放                                                  | 本 repo 目前的行為                                     | 建議                         |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------- |
| `WEBAUTHN_ENABLED`                  | —                                        | —                                                                              | Gitea、Nextcloud 有伺服器層級開關（設定檔，預設開啟），不在 UI 上 | 沒有路由讀取，沒有作用                                 | 移除                         |
| `WEBAUTHN_RP_NAME`                  | —                                        | 「Human-readable title for your website」                                      | 都用應用程式名稱或網域                                            | 預設 `SubsTracker`                                     | 移除，固定為 `SubsTracker`   |
| `WEBAUTHN_RP_ID`                    | 預設為呼叫端 origin 的 effective domain  | 「Valid domain name (after `https://`)」                                       | 都來自伺服器網址設定或請求 Host，沒有人放在一般設定頁             | 空白時用可註冊網域（`psl`）                            | 移除，改用請求的完整主機名稱 |
| `WEBAUTHN_RP_ORIGINS`               | —                                        | `expectedOrigin` 可以是陣列                                                    | 都只接受自己的 origin                                             | 空白時接受請求的 `Origin` 標頭；另外提供 `.well-known` | 移除（見 5.2）               |
| `WEBAUTHN_ATTESTATION`              | `"none"`                                 | 預設 `'none'`；文件：「Don't prompt users for additional information」         | Gitea、Nextcloud 固定 `none`；authentik 固定 `direct`             | 可選 `none`／`direct`／`enterprise`，但沒有驗證憑證鏈  | 移除，固定 `none`            |
| `WEBAUTHN_AUTHENTICATOR_ATTACHMENT` | 不設                                     | 不設                                                                           | 只有 Pocket ID、authentik 開放給管理員當政策                      | 可選                                                   | 移除，不設                   |
| `WEBAUTHN_RESIDENT_KEY`             | 不設時為 `discouraged`                   | 預設 `'preferred'`                                                             | Gitea、Pocket ID 固定 `required`；Nextcloud 不設                  | 預設 `preferred`                                       | 移除，固定 `preferred`       |
| `WEBAUTHN_USER_VERIFICATION`        | `"preferred"`                            | options 預設 `'preferred'`；verify 預設 `requireUserVerification = true`       | Gitea 固定 `required`；Pocket ID 預設 `required`                  | options 可選；verify 一律要求 UV                       | 移除，兩端都固定 `required`  |
| `WEBAUTHN_TIMEOUT`                  | 建議 300000–600000，預設 300000（§15.1） | 預設 `60000`                                                                   | Pocket ID、Nextcloud、Vaultwarden 固定 60 秒                      | 預設 60000；challenge TTL 300 秒                       | 移除，固定 300000            |
| `WEBAUTHN_HINTS`                    | `[]`                                     | 13.2.2 只在註冊時提供單一值的 `preferredAuthenticatorType`，登入選項沒有 hints | 只有 authentik 開放                                               | 沒有傳給函式庫，沒有作用                               | 移除                         |

各列的依據：

- 規格預設：`attestation` 預設 `"none"`（L3 §5.4 `attestation, of type DOMString, defaulting to "none"`）；`userVerification` 預設 `"preferred"`；`residentKey`「If no value is given then the effective value is required if requireResidentKey is true or discouraged if it is false or absent.」；`hints` 預設 `[]`；§15.1「Recommended range: 300000 milliseconds to 600000 milliseconds. Recommended default value: 300000 milliseconds (5 minutes).」〔查證〕
- `enterprise`：「User agents MUST NOT provide such an attestation unless the user agent or authenticator configuration permits it for the requested RP ID.」自架個人應用不會有這種瀏覽器政策。〔查證條文；結論為推論〕
- L3 的變更記錄：「aaguid in attested credential data is no longer zeroed when attestation preference is none」。所以 `attestation: 'none'` 仍然可以用 AAGUID 顯示提供者名稱。〔查證〕
- SimpleWebAuthn 對 `residentKey` 的說明：`'preferred'`「Will always generate synced passkeys on Android devices, but will consume discoverable credential slots on security keys.」；`'required'`「Same as 'preferred'」。對 `userVerification: 'required'`：「User verification should never be false.」〔查證：https://simplewebauthn.dev/docs/packages/server 〕
- SimpleWebAuthn：「Setting a value for preferredAuthenticatorType will overwrite any value that may have been specified for authenticatorSelection.authenticatorAttachment!」〔查證〕
- Gitea 固定 `UserVerification: Required` 的原因（原始碼註解）：「anything else makes Chromium raise it to credProtect level 3, hiding it from the second factor」。〔查證〕
- 本 repo 目前 verify 一律要求 UV，所以把 options 改為 `required` 不會改變哪些驗證器能登入，只會讓瀏覽器在註冊與登入時一定要求 PIN 或生物辨識，而不是讓驗證器略過後再被伺服器拒絕。〔推論〕

### 5.1 RP ID 與 origin 能不能從請求推導

規格條文〔查證：WebAuthn L3〕：

- §5.11：「By default, Web Authentication requires that the RP ID be equal to the origin’s effective domain, or a registrable domain suffix of the origin’s effective domain.」
- §13.4.8：子網域上的惡意程式碼可以使用 RP ID 範圍內的憑證。「Therefore, the Relying Party by default SHOULD NOT allow a subdomain origin when verifying the assertion.」
- §13.4.9：「The Relying Party MUST NOT accept unexpected values of origin」。只在 `https://example.org` 提供服務的應用「SHOULD require origin to exactly equal https://example.org」。

Cloudflare Workers 的網址〔查證〕：

- workers.dev：「All Workers are assigned a workers.dev route when they are created or renamed following the syntax `<YOUR_WORKER_NAME>.<YOUR_SUBDOMAIN>.workers.dev`.」可以用 `workers_dev = false` 關閉。https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- Version URL：`<version-prefix>-<worker-name>.<subdomain>.workers.dev`，與 workers.dev 同時開啟，可以用 `preview_urls = false` 關閉。https://developers.cloudflare.com/workers/configuration/previews/
- Custom Domain：「An incoming request must exactly match the domain or subdomain your Custom Domain is registered to.」https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- 本 repo 的 `wrangler.toml` 沒有 `routes`、`workers_dev` 或 `preview_urls`，所以部署後使用 workers.dev 網址。〔查證〕

`psl` 的實測結果〔查證：本 repo `node_modules/psl` 1.15.0〕：

| 主機名稱                         | `psl.get()`（目前的 RP ID 推導） |
| -------------------------------- | -------------------------------- |
| `subs-tracker.madao.workers.dev` | `madao.workers.dev`              |
| `app.example.com`                | `example.com`                    |
| `localhost`                      | `null`（程式改用 `localhost`）   |

結論：

- 目前的推導在 workers.dev 上把 RP ID 設為整個帳號子網域。同帳號的其他 Worker（包含 Version URL）都在這個 RP ID 的範圍內。〔查證〕
- 目前沒有設定 `WEBAUTHN_RP_ORIGINS` 時，`expectedOrigin` 等於請求送來的 `Origin` 標頭，RP ID 也由同一個標頭推導。這等於沒有檢查 origin，違反 §13.4.9。〔查證程式碼；違反規格為推論〕同帳號下另一個 Worker 如果執行不受信任的程式碼，可以替 `madao.workers.dev` 取得 assertion，再帶著自己的 `Origin` 送到本 repo 的驗證端點。〔推論，未實測〕
- 改用請求 URL 的完整主機名稱當 RP ID、用請求 URL 的 origin 當 `expectedOrigin`，可以同時滿足 §13.4.8 與 §13.4.9。Nextcloud 與 authentik 從請求 Host 推導 RP ID，Pocket ID 用完整主機名稱而不是可註冊網域。〔查證各專案；對本 repo 的適用性為推論〕
- 在 Workers 上，`c.req.url` 的主機名稱只會是 Cloudflare 路由到這個 Worker 的主機名稱（workers.dev、Version URL、Custom Domain 或 route）。〔推論：Cloudflare 文件描述路由比對規則，但沒有明文說明 `request.url` 的 host〕
- 代價：passkey 綁定註冊時的主機名稱。在 workers.dev 註冊的 passkey 不能在 Custom Domain 使用，反之亦然。〔查證：§5.11 的 RP ID 規則〕處理方式是選定一個正式網址。加上 Custom Domain 後，設定 `workers_dev = false` 與 `preview_urls = false`，或讓 workers.dev 轉址到正式網址。〔推論〕

### 5.2 Related Origin Requests 與 `/.well-known/webauthn`

- 規格：JSON 必須放在 RP ID 的 `https://{RP ID}/.well-known/webauthn`，`origins`「MUST be an array of one or more strings」。〔查證：L3 §5.11〕
- 目前沒有設定時，`/.well-known/webauthn` 回傳 `{"origins":[]}`（`src/index.tsx:54-59`），不符合「one or more」。〔查證〕
- passkeys.dev：「ROR is designed to be used when federation is _not_ possible!」；與 RP ID 相同的 origin 不要列入；目前沒有客戶端支援超過 5 個 label。〔查證：https://passkeys.dev/docs/advanced/related-origins/ 〕
- 本 repo 可能用到 ROR 的情況只有「同時開放 workers.dev 與 Custom Domain」。對單一使用者，選定一個正式網址比 ROR 簡單，也不依賴瀏覽器支援。〔推論〕
- `extractRelatedOrigins()` 與 `validateOrigin()` 沒有呼叫端。〔查證：`grep` `src/`〕

### 5.3 是否需要獨立的「啟用 WebAuthn」開關

- Gitea（`ENABLE_PASSKEY_AUTHENTICATION`）與 Nextcloud（`auth.webauthn.enabled`）的開關在伺服器設定檔，預設開啟，用途是讓站台管理員對所有使用者關閉功能。〔查證〕
- 使用者層級沒有開關：GitHub、Google、Gitea、Nextcloud 都是「有 passkey 就能用 passkey 登入」。〔查證：第 3、4 節來源〕
- 本 repo 只有一位使用者，站台管理員與使用者是同一人。「至少有一個 passkey」就可以代表已啟用。〔推論〕
- 密碼登入的保留方式：Google 在建立 passkey 後仍然允許密碼登入〔查證〕；Gitea 在安全金鑰頁警告遺失金鑰會失去帳號存取，建議設定其他驗證方式〔查證〕。本 repo 的密碼登入不受 passkey 影響（`src/routes/auth.ts:125-152`），刪除所有 passkey 不會鎖住帳號。〔查證〕

### 5.4 每筆 passkey 的資料

| 欄位                         | Google 指引 | Pocket ID        | Gitea               | Nextcloud    | authentik                       | 本 repo 目前                                    |
| ---------------------------- | ----------- | ---------------- | ------------------- | ------------ | ------------------------------- | ----------------------------------------------- |
| 名稱（可改）                 | 有          | 有               | 有（不能改）        | 有（不能改） | 有                              | 有（`nickname`，註冊時空白）                    |
| 由 AAGUID 產生預設名稱／圖示 | 有          | 有               | 儲存 AAGUID，不顯示 | 沒有         | 儲存 AAGUID 與裝置類型，UI 未查 | 沒有儲存 AAGUID                                 |
| 建立時間                     | 有          | 有               | 有                  | 沒有         | 儲存，UI 未查                   | 有                                              |
| 最後使用時間                 | 有          | 沒有             | 沒有                | 沒有         | 儲存，UI 未查                   | 有                                              |
| 同步／僅此裝置               | 有          | 儲存但清單不顯示 | 沒有                | 沒有         | 沒有                            | 註冊時儲存 `backedUp`，登入後不更新；清單不顯示 |
| 傳輸方式（usb、nfc…）        | 沒有        | 沒有             | 沒有                | 沒有         | 沒有                            | 顯示                                            |

〔查證：第 2、3 節來源；本 repo `src/client/config/index.ts:355-393`〕

AAGUID 對照表〔查證：https://github.com/passkeydeveloper/passkey-authenticator-aaguids ，HEAD `5efd28d67528d31877df5c6621c966cb85b57f71`〕：

- 用途：讓 RP 在帳號設定顯示 passkey 提供者的名稱。README 說明它不取代 FIDO MDS，而且將來可能停止維護，取得時要處理空物件。
- `aaguid.json` 有 58 筆，檔案 368,498 bytes，大部分是 base64 SVG 圖示。只取名稱約 3 KB。
- 例：`fbfc3007-154e-4ecc-8c0b-6e020557d7bd` = Apple Passwords；`ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4` = Google Password Manager；`bada5566-a7aa-401f-bd96-45619a55120d` = 1Password；`d548826e-79b4-db40-a3d8-11116f7e8349` = Bitwarden。
- repo 根目錄沒有 `LICENSE` 檔（`raw.githubusercontent.com/.../main/LICENSE` 回傳 404）。打包進本 repo 前，先確認授權。

`@simplewebauthn/server` 13.2.2 可以提供這些資料〔查證〕：

- `verifyRegistrationResponse()` 的 `registrationInfo` 有 `aaguid`、`credentialDeviceType`、`credentialBackedUp`（`esm/registration/verifyRegistrationResponse.js:191-208`）。
- `verifyAuthenticationResponse()` 的 `authenticationInfo` 有 `credentialDeviceType`、`credentialBackedUp`、`userVerified`（`esm/authentication/verifyAuthenticationResponse.js`）。

### 5.5 其他發現

- **`user.id` 每次註冊都不同。** 本 repo 沒有傳入 `userID`，函式庫每次產生新的隨機值（`generateRegistrationOptions.js` 中 `if (!_userID) _userID = await generateUserID()`）。規格建議把 user handle 存在帳號中（§14.6.1）；Apple 說明相同 user ID 的註冊會覆寫裝置上的舊 passkey；Signal API 的 `signalAllAcceptedCredentials` 需要 user ID。〔查證〕
- **清單以 `innerHTML` 插入 `nickname`，沒有跳脫。** 名稱含 HTML 時會被執行。只有已登入的管理員能設定名稱，所以影響範圍是自己。〔查證：`src/client/config/index.ts:362-364`〕
- **修改密碼不需要目前的密碼。** `PUT /api/config` 只檢查 JWT，JWT 有效 7 天。〔查證：`src/routes/config.ts` 的 `updateConfigRoute` handler、`src/utils/crypto.ts:11`〕這不在本文範圍內，但第 7 節的重新驗證機制也可以用在這裡。〔推論〕
- **登入頁一定要先輸入帳號名稱。** `Login.tsx:37` 已經有 `autocomplete="username webauthn"`，但 `src/client/login/webauthn.ts` 沒有使用 conditional mediation。SimpleWebAuthn 以 `startAuthentication({ ..., useBrowserAutofill: true })` 支援瀏覽器自動填入；web.dev 說明 conditional 登入要把 `allowCredentials` 設為空陣列。〔查證：https://simplewebauthn.dev/docs/packages/browser 、https://web.dev/articles/passkey-form-autofill 〕這需要 discoverable credential，也就是 `residentKey: 'required'`。〔推論〕

---

## 6. 重新驗證

| 產品        | 新增 passkey           | 刪除 passkey         | 改名   | 來源                                       |
| ----------- | ---------------------- | -------------------- | ------ | ------------------------------------------ |
| GitHub      | 要求（密碼或其他方式） | 文件沒有說明         | —      | GitHub Docs（第 4 節）〔查證〕             |
| Nextcloud   | 確認密碼               | 確認密碼             | 不能改 | `WebAuthnController.php`〔查證〕           |
| Vaultwarden | 主密碼或 OTP           | 主密碼               | —      | `webauthn.rs:111-136,319-321`〔查證〕      |
| Pocket ID   | 不要求                 | 不要求               | 不要求 | `module.go:91-93`〔查證〕                  |
| Gitea       | 不要求（未找到檢查）   | 不要求（未找到檢查） | 不能改 | `security/webauthn.go`〔查證：未找到檢查〕 |

- web.dev 要求建立 passkey 前在短時間內驗證過使用者，並警告只用密碼驗證的風險。〔查證〕本 repo 只有密碼與 passkey 兩種方式，沒有 email 或 OTP，所以只能接受「密碼或既有 passkey」。〔推論〕
- 本 repo 的 JWT 有 `iat`（`src/utils/crypto.ts:42`）。可以用 `iat` 判斷登入時間是否在最近 N 分鐘內，不需要新的 KV 狀態。〔查證 `iat`；做法為推論〕

---

## 7. 對本 repo 的建議

### 7.1 移除的設定

從 `Config.tsx`、`src/client/config/index.ts`、`src/routes/config.ts`（兩個 schema 與預設回應）、`src/services/config.ts`（`DEFAULT_CONFIG` 與 `getConfig()`）、`src/types/index.ts`、`src/types/webauthn.ts` 的 `WebAuthnConfig` 移除：

| 設定                                | 改為                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| `WEBAUTHN_ENABLED`                  | 刪除。至少有一個 passkey 時，passkey 登入可用                                        |
| `WEBAUTHN_RP_NAME`                  | 固定 `'SubsTracker'`                                                                 |
| `WEBAUTHN_RP_ID`                    | 註冊：`new URL(c.req.url).hostname`。登入：見 7.3                                    |
| `WEBAUTHN_RP_ORIGINS`               | `expectedOrigin = new URL(c.req.url).origin`。刪除 `/.well-known/webauthn` 路由      |
| `WEBAUTHN_ATTESTATION`              | 固定 `'none'`（使用函式庫預設，不傳參數）                                            |
| `WEBAUTHN_AUTHENTICATOR_ATTACHMENT` | 不傳                                                                                 |
| `WEBAUTHN_RESIDENT_KEY`             | 固定 `'preferred'`（函式庫預設）。改成 autofill 登入時再改為 `'required'`            |
| `WEBAUTHN_USER_VERIFICATION`        | options 固定 `'required'`；verify 保持 `requireUserVerification: true`（函式庫預設） |
| `WEBAUTHN_TIMEOUT`                  | 固定 `300000`，與 challenge 的 KV TTL（300 秒，`src/services/webauthn.ts:187`）一致  |
| `WEBAUTHN_HINTS`                    | 刪除                                                                                 |

同時刪除沒有呼叫端的 `extractRPID()` 的 `psl` 推導（登入的相容處理除外，見 7.3）、`extractRelatedOrigins()`、`validateOrigin()`。〔推論：刪除後 `psl` 與 `@types/psl` 可能只剩 7.3 的遷移用途〕

`GET/PUT /api/config` 的回應與請求 schema 會少掉 `WEBAUTHN_*` 欄位。依 `AGENTS.md`，commit 要加上 `BREAKING CHANGE:` footer。

設定頁可以用一行唯讀文字顯示目前的 RP ID（主機名稱），方便使用者理解「passkey 只在這個網址有效」。〔推論〕

### 7.2 Passkey 分頁

- 標題改為「Passkey」。說明文字：passkey 綁定目前網址；密碼登入一直可用。
- 沒有 passkey：顯示目前的空狀態與「新增 passkey」按鈕（FIDO 的 hero prompt）。
- 每筆一張卡片，顯示：
  - 名稱。註冊時預設為 AAGUID 對應的提供者名稱；查不到時用「Passkey」加建立日期。可以改名。
  - 提供者名稱（名稱被改過時仍然顯示）。
  - 建立時間、最後使用時間（沒有使用過時顯示「尚未使用」）。
  - 「已同步」或「僅限此裝置」，依 `backedUp`。
  - 註冊時的 RP ID 與目前主機名稱不同時，顯示「在此網址無法使用」。
- 不顯示傳輸方式。
- 名稱用 `textContent` 或跳脫後再插入。
- 刪除確認文字：刪除後這個 passkey 不能登入；刪除最後一個時，加上「之後只能用密碼登入」。
- 刪除成功後，如果瀏覽器支援，呼叫 `PublicKeyCredential.signalAllAcceptedCredentials()`，傳入固定的 user ID 與剩下的 credential ID。〔推論：需要 7.4 的固定 user handle〕
- 登入頁：沒有 passkey 時不顯示「使用 Passkey 登入」按鈕。〔推論：單一使用者，不會洩漏帳號資訊〕

AAGUID 名稱的取得方式：在建置時從 `aaguid.json` 產生只含名稱的 JSON（約 3 KB），打包進 Worker。先確認授權（5.4）。〔推論〕

### 7.3 重新驗證

- 需要重新驗證：`POST /api/webauthn/register/options`、`POST /api/webauthn/register/verify`、`DELETE /api/webauthn/credentials/:id`。
- 不需要：`GET /api/webauthn/credentials`、`PUT /api/webauthn/credentials/:id`（改名）。
- 條件：JWT 的 `iat` 在 10 分鐘內。否則回傳 401 與可辨識的錯誤碼，前端要求輸入目前的密碼或完成一次 passkey 驗證，成功後簽發新的 JWT 再重試。
- 10 分鐘是本文的選擇。GitHub 用 2 小時〔查證〕；Nextcloud 的密碼確認沿用自身的設定〔未查〕。
- 新增或刪除 passkey 後，透過已設定的通知渠道送出通知（web.dev 建議註冊時通知）。〔推論〕

### 7.4 KV 與設定遷移

| 項目                       | 目前                                         | 改為                                                                    | 遷移方式                                                                                                                                                                                                                                                                                         |
| -------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `config` 中的 `WEBAUTHN_*` | 10 個欄位                                    | 不存在                                                                  | `getConfig()` 逐欄建立物件（`src/services/config.ts`），不會帶出未列出的欄位。移除欄位後，下一次 `updateConfig()` 寫入就會刪掉。遷移時先讀取舊的 `WEBAUTHN_RP_ID`，供下一列使用。〔查證 `getConfig()` 結構；其餘為推論〕                                                                         |
| 憑證的 RP ID               | 沒有記錄                                     | 每筆 `webauthn:credential:<id>` 新增 `rpId`                             | 舊憑證的 `rpId` 設為當時的有效值：`config.WEBAUTHN_RP_ID`，空白時用 `psl.get(目前主機名稱)`。登入時，以 `rpId` 等於目前主機名稱或是它的可註冊後綴的憑證組成 `allowCredentials`，並用那個 `rpId` 呼叫 `generateAuthenticationOptions()`。authentik 也逐筆儲存 `rp_id`。〔推論；authentik 為查證〕 |
| 憑證的 AAGUID              | 沒有記錄                                     | 新增 `aaguid`                                                           | 舊憑證不能補。清單顯示「未知的提供者」。〔推論〕                                                                                                                                                                                                                                                 |
| 憑證的 `backedUp`          | 只在註冊時寫入                               | 每次登入以 `authenticationInfo.credentialBackedUp` 更新                 | 不需要遷移                                                                                                                                                                                                                                                                                       |
| 憑證索引                   | `webauthn:user:<ADMIN_USERNAME>:credentials` | `webauthn:credentials`                                                  | 讀取時如果新 key 不存在，讀舊 key（用目前的 `ADMIN_USERNAME`），寫入新 key 後刪除舊 key。登入路由不再比對 `username` 與憑證的關係。〔推論〕                                                                                                                                                      |
| user handle                | 每次註冊隨機產生，沒有儲存                   | KV `webauthn:user-handle`，64 個隨機 bytes（§14.6.1），第一次註冊時產生 | 舊憑證的 user handle 不能更改。舊憑證仍然可以登入，因為登入以 credential ID 查詢。〔推論〕                                                                                                                                                                                                       |
| `/.well-known/webauthn`    | 回傳設定中的 origins                         | 刪除路由                                                                | 如果有人依賴 ROR，改為選定正式網址或轉址（5.1）。                                                                                                                                                                                                                                                |

`docs/dogfood.md` 第 3 節的「WebAuthn hints」與第 4 節的「在設定頁啟用 WebAuthn」要一起更新。

### 7.5 未查證或未決定的事項

- GitHub 與 Google 的 passkey 清單實際顯示哪些欄位：官方文件沒有完整列出。
- Cloudflare 是否保證 `request.url` 的主機名稱等於路由比對的主機名稱：文件沒有明文說明。
- `passkey-authenticator-aaguids` 的授權。
- 是否要在同一次變更中加入 autofill 登入（需要 `residentKey: 'required'` 與登入流程修改）。
