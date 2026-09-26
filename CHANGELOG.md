## [2.0.0](https://github.com/gn00678465/subs-tracker/compare/v1.2.0...v2.0.0) (2026-09-26)

### ⚠ BREAKING CHANGES

* **routes:** /api/notify/{token} 已移除，呼叫這個 API 的外部程式會收到 404。
  KV 中既有的 API_TOKEN 值不再讀取，下次儲存設定時會被移除。
* **webauthn:** /api/webauthn/authenticate/options 不再需要 username，改收
  conditional；/api/webauthn/credentials 的回應改為 nickname、provider、synced、
  usableHere；PUT /api/settings/account 需要 10 分鐘內登入過。
* **config:** config API 移除 NOTIFICATION_HOURS，改用 REMINDER_HOUR。
* **config:** 不再有 subscription-manager 與 subscription-manager-staging
  兩個 Worker 名稱，`bun run deploy` 只部署 subs-tracker。
* **settings:** 移除 GET/PUT /api/config。改用 GET /api/settings、
  PUT /api/settings/{reminder,account,channels/{channel}}、
  POST /api/settings/channels/{channel}/test 與 GET /api/settings/export。
* **subscriptions:** 訂閱 API 的 expiryDate 與 startDate 只接受 YYYY-MM-DD，
  回應也改為這個格式；customType 欄位已移除。
* **db:** 訂閱改用 price（數字）、reminder、paymentMethod、
  cancelByDate；移除 /{id}/toggle（改用 PUT isActive）、/{id}/test、
  /.well-known/webauthn 與設定中的 WEBAUTHN_*。部署前需套用 D1 migration。

### Features

* **config:** 通知時段改為每日提醒時間，Cron 改為每小時執行 ([9524b80](https://github.com/gn00678465/subs-tracker/commit/9524b8083dd14eebd73789278a44e655852decc5))
* **db:** 所有資料改存 D1，第一次讀取時匯入 KV ([e0d3122](https://github.com/gn00678465/subs-tracker/commit/e0d3122ccf029897a0af3c74d2e57330cabd3b00))
* **routes:** 移除第三方通知 API 與 API_TOKEN 設定 ([8e1287b](https://github.com/gn00678465/subs-tracker/commit/8e1287b4fb407cbbbe300154011d53d82555ffcb))
* **settings:** 設定 API 依段落拆開，新增管道測試與 JSON 匯出 ([61299bc](https://github.com/gn00678465/subs-tracker/commit/61299bc23e6c4e8c1573e5d2b8737d25bca32bd0))
* **subscriptions:** 到期日改存日曆日期並合併分類欄位 ([c968d4b](https://github.com/gn00678465/subs-tracker/commit/c968d4b7e1fad7e847131442be9309aabd1f383e))
* **ui:** 換上原型的樣式與新的登入頁，移除 daisyUI 與 Tailwind ([c6bcb82](https://github.com/gn00678465/subs-tracker/commit/c6bcb822b6b275d4d73d9e477cf8d4a519aeaa9a))
* **ui:** 新增訂閱的新增與編輯表單 ([1484a20](https://github.com/gn00678465/subs-tracker/commit/1484a20249b40615b7ea56e32234453aa607f06e)), references [#new](https://github.com/gn00678465/subs-tracker/issues/new)
* **ui:** 新增設定頁 ([9971d25](https://github.com/gn00678465/subs-tracker/commit/9971d25f71f190caac96ab3135aa7802ec111c9c))
* **ui:** 新增首頁卡匣 ([c157085](https://github.com/gn00678465/subs-tracker/commit/c157085affc71bbe9df48b9823b757c9c0707474))
* **ui:** 日期欄位改用 shadcn 風格的月曆 ([5e3292e](https://github.com/gn00678465/subs-tracker/commit/5e3292e2dc5b7e08b4d5a22e753a4d1f8cd1604e))
* **ui:** 桌機的月曆改成浮動彈出 ([b8c3d5e](https://github.com/gn00678465/subs-tracker/commit/b8c3d5ef2f5da66e447f6dc34ff2472f0f5d38f2))
* **ui:** 離線時顯示最後一次取得的資料 ([528b58c](https://github.com/gn00678465/subs-tracker/commit/528b58c04c9ac50bf2a2ed85844e83af1481f11e))
* **webauthn:** passkey 改存 D1，新增與刪除前要重新驗證 ([bef3384](https://github.com/gn00678465/subs-tracker/commit/bef3384b00cb1bec253557c4b17b791eda8026eb))

### Bug Fixes

* **config:** 在建立 tag 前產生 changelog ([dca24c4](https://github.com/gn00678465/subs-tracker/commit/dca24c4007e9f5316124fe652354faf9a19f3697)), closes [#10](https://github.com/gn00678465/subs-tracker/issues/10)
* **deps:** 升級 [@simplewebauthn](https://github.com/simplewebauthn) 到 14.x ([8f73aed](https://github.com/gn00678465/subs-tracker/commit/8f73aed8f19c9379c08df9939ebcdc74a7280929)), closes [#9](https://github.com/gn00678465/subs-tracker/issues/9)
* **notifier:** Webhook 內容不再夾帶退格字元 ([812e4d9](https://github.com/gn00678465/subs-tracker/commit/812e4d9cd4e39aacb7f13f80c627f4c64e5f60b1))
* **ui:** 已停用與已過期的卡改用不透明混色 ([561bb41](https://github.com/gn00678465/subs-tracker/commit/561bb41d280012fb98183fb6303bade817a28b03))
* **ui:** 所有文字的對比達到 WCAG AA ([9ad1de0](https://github.com/gn00678465/subs-tracker/commit/9ad1de079d2ba956dc918b0a3cb0d75b66f78325))
* **ui:** 新增與編輯表單輸入第一個字後不再失去焦點 ([4dc4669](https://github.com/gn00678465/subs-tracker/commit/4dc4669d03a7b46bb23b3b5091f92685a09e005d))
* **ui:** 深色主題「已啟用」的文字對比達到 WCAG AA ([a62468a](https://github.com/gn00678465/subs-tracker/commit/a62468a75a3ef6e5d22dbb9740ef90960cd362bc))

### Build System

* **config:** 刪除 wrangler 的 production 與 staging 環境 ([9b157a1](https://github.com/gn00678465/subs-tracker/commit/9b157a14a5795f05462d8a1fa0db159c21797839))
