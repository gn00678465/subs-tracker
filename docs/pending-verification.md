# 待驗證項目

分支 `chore/upgrade-toolchain` 升級工具鏈後，下列項目還沒有驗證。UI 重構與流程調整完成後，一次驗證全部項目。驗證完成的項目從本文件刪除。

## 驗證環境

- 本機驗證用 `bun run preview`，不用 `bun run dev`。dev 執行的是未打包的模組，preview 執行的是部署用的打包產物。例如 SimpleWebAuthn 13.3.x 的啟動錯誤只在打包後出現。
- 用全新的本機 KV：在乾淨的 clone 中執行，或先刪除 `.wrangler/`。全新 KV 使用 `src/services/config.ts` 的 `DEFAULT_CONFIG` 帳密。
- 第 3 節的項目需要部署到 staging。

## 已驗證（2026-09-26，commit `c75b38d`，preview + 全新 KV）

`bun run check`、`bun run build`、JSON 與表單登入、讀取設定、新增與讀取訂閱（KV 寫入）、驗證錯誤格式、WebAuthn 註冊 options、`/admin`、`/admin/config`、`/doc`、`/ui`、Cron（`/cdn-cgi/handler/scheduled`，沒有啟用通知渠道）。

## 1. 瀏覽器行為

| 項目                         | 相關 commit                                                     | 驗證方法                                                                                                 |
| ---------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 設定頁載入並填入所有欄位     | `474aa07`（`src/client/config/index.ts` 的型別改寫）            | 開啟 `/admin/config`，確認每個欄位都有值，console 沒有錯誤                                               |
| Bark「保存推送」勾選狀態     | `474aa07`（判斷改為 `String(config.BARK_SAVE) === 'true'`）     | 分別存成勾選與不勾選，重新載入後確認狀態                                                                 |
| WebAuthn hints 勾選狀態      | `474aa07`（`includes` 改為 `some`）                             | 勾選部分 hints，儲存後重新載入                                                                           |
| 設定表單送出                 | `474aa07`（`Record<string, unknown>`）                          | 修改設定並儲存，確認 `/api/config` 回傳新值                                                              |
| Passkey 清單顯示             | `474aa07`（清單型別改為不含 `publicKey` 的 `StoredCredential`） | 有 passkey 時，確認名稱、建立時間、傳輸方式、編輯與刪除按鈕                                              |
| 動態 HTML 的圖示             | `474aa07`（`window.lucide` 的宣告移到 `src/client/icons.ts`）   | Passkey 清單重新渲染後，圖示正常顯示                                                                     |
| lucide v1 圖示外觀           | `1cace16`                                                       | 目視檢查 `edit-3`、`fingerprint`、`trash-2`（v1 分別是 `PenLine`、`FingerprintPattern`、`Trash` 的別名） |
| Passkey 註冊與登入的錯誤訊息 | `474aa07`（`catch` 改為先轉成 `Error`）                         | 取消註冊與登入對話框，確認顯示「已取消」或不顯示錯誤                                                     |
| 瀏覽器支援下限               | `68be3d8`（Vite 8 預設 target 為 Chrome 111、Safari 16.4 等）   | 確認目標使用者的瀏覽器版本                                                                               |

## 2. 需要真實驗證器的流程

| 項目                           | 相關 commit                         | 驗證方法                                           |
| ------------------------------ | ----------------------------------- | -------------------------------------------------- |
| Passkey 註冊、登入、改名、刪除 | `68be3d8`（Vite 8 打包）、`474aa07` | 用真實的驗證器（平台驗證器或安全金鑰）完成整個流程 |

## 3. 需要部署到 staging

| 項目                           | 相關 commit                   | 驗證方法                                                                                                                           |
| ------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 部署指令                       | `68be3d8`                     | 使用 `@cloudflare/vite-plugin` 時，環境可能要在 build 時用 `CLOUDFLARE_ENV` 指定，`wrangler deploy --env staging` 能否使用：未驗證 |
| 真實 KV、secrets、Cron Trigger | `68be3d8`、`615ba22`          | 部署後觸發 Cron，確認讀寫 KV 正常                                                                                                  |
| Telegram、Bark 實際發送        | `474aa07`（回應改用具體型別） | 設定渠道後觸發通知，確認成功與失敗訊息                                                                                             |
| Resend 實際發送                | `f80e939`（resend 6.30.0）    | 同上                                                                                                                               |
| Webhook 實際發送               | —                             | 同上                                                                                                                               |

## 4. 待決定事項

| 項目                | 相關 commit           | 說明                                                                                                                                                                                  |
| ------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 驗證錯誤格式改變    | `11070d3`             | 所有子路由改用 `{ success: false, message, errors }`。若有外部程式呼叫 `/api/notify/{token}` 並解析舊格式，需要補上 `BREAKING CHANGE` 標記並通知呼叫端                                |
| changelog 沒有內容  | `f80e939`             | `bun run changelog` 在新舊版本都產生空的 changelog，原因未查明。發布前需要處理                                                                                                        |
| 發布流程            | `f80e939`（bumpp 12） | `bun run release` 會推送到遠端，沒有實際執行過                                                                                                                                        |
| SimpleWebAuthn 升級 | —                     | 維持 13.2.2。13.3.x 與 14.x 的打包 Worker 在啟動時失敗（見 `docs/research/2026-09-26-toolchain-upgrade.md` 的執行結果）。14.0.2 的兩個 Moderate 與 13.3.2 的一個 Low 安全修正沒有套用 |
