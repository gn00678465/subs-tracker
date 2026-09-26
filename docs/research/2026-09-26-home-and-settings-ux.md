# 首頁組成與設定項目研究：單人自架訂閱追蹤器

- 查核日期：2026-09-26
- 範圍：
  - (A) 手機（390px 寬）打開 app 時，首頁先顯示什麼。桌機寬度多顯示什麼。
  - (B) 成熟的訂閱追蹤產品有哪些設定與訂閱欄位是本 repo 沒有的，以及本 repo 有、但其他產品不需要的。
- 不在範圍內（已決定，不重新研究）：每日提醒時間與時區、移除 `/api/notify` 與 `API_TOKEN`、`customType` 併入 `category`、總花費依貨幣分開且不換算匯率、passkey 設定（另見 `docs/research/2026-09-26-passkey-settings-ux.md`）。
- 本 repo 的狀態以分支 `feat/ui-redesign` 的 `c968d4b` 為準（`customType` 已移除，`API_TOKEN` 已移除）。
- 方法：
  - 開源專案：在 scratchpad 目錄 clone 原始碼，閱讀頁面範本、資料結構、排程與 repo 內的截圖。本 repo 沒有任何檔案變更（本文件除外）。
  - 商業產品與平台：閱讀 App Store 頁面、官方說明中心與支援文件。
  - UX 研究：Nielsen Norman Group 文章、Apple Human Interface Guidelines（HIG）、Material Design 元件文件。
- 標記：
  - **【查證】**：直接讀過原始碼、截圖或文件。
  - **【推論】**：由查證的資料推導，沒有直接證據。
  - **【次要來源】**：第三方評論，不是產品本身的文件。

開源專案的檔案路徑以下列 commit 為準（完整 URL 見第 9 節）：

| 簡稱        | Repo                                  | Commit    | 說明                                                   |
| ----------- | ------------------------------------- | --------- | ------------------------------------------------------ |
| Wallos      | `ellite/Wallos`                       | `844cea0` | PHP + SQLite，v5.8.1，8.5k star，最主要的參考          |
| SubTrackr   | `bscott/subtrackr`                    | `cf0d591` | Go + HTMX + SQLite                                     |
| Renewlet    | `zhiyingzzhou/renewlet`               | `e7ae44a` | React，可部署到 Cloudflare Workers（D1），0.3.27       |
| RET         | `DennisBauer/RecurringExpenseTracker` | `76a0453` | Kotlin Multiplatform，Android 原生 app，Material You   |
| Firefly III | 文件                                  | —         | 個人記帳軟體的 subscriptions（原 bills），作為相鄰參考 |

---

## 1. 摘要與建議

### 1.1 最重要的發現

1. **本 repo 的首頁沒有顯示價格，也沒有任何總額。** `SubscriptionTableRow.tsx` 沒有讀取 `price`，`src/client`、`src/components/admin`、`src/pages/Admin.tsx` 內沒有加總的程式碼。【查證】PRODUCT.md 的成功標準是「打開 app 就能看到接下來要扣款的項目與總花費」，目前兩者都不成立。
2. **手機上第一個畫面大部分被搜尋區塊與單筆訂閱佔用。** `Admin.tsx:17-55` 在列表前放了搜尋框、分類篩選與新增按鈕。每一列在手機上拆成 6 個帶標籤的儲存格，最後是 4 個 `btn-xs` 按鈕（`SubscriptionTableRow.tsx:52-139`）。【查證】估計 390×844 的畫面只看得到 1–2 筆訂閱。【推論，未實測】
3. **「免費試用」目前只被儲存，沒有任何作用。** `isFreeTrial` 只出現在表單、路由驗證與儲存程式碼中。排程（`subscription_cron.ts`）、通知內容（`notifier/index.ts:139-157`）與列表都沒有讀取它。【查證】PRODUCT.md 的第一個工作「不錯過免費試用到期」因此沒有實際支援。
4. **成熟產品的首頁都以「即將扣款」為主，但放的位置不同。** Wallos 在問候語之後先放「逾期續訂」與「即將付款」，總額放在下方（`index.php:151-469`）。Renewlet 先放 4 張統計卡，「即將續費」在手機上排到最後（`dashboard.tsx:138-265`）。Rocket Money 的 Recurring 分頁預設顯示 Upcoming，依預計扣款日排序。【查證】
5. **Wallos 與 Renewlet 的手機首頁都浪費了第一個畫面。** Wallos 的「即將付款」是橫向捲動的卡片，預設只取 3 筆（`upcoming_payments.php:3`）。Renewlet 手機版的訂閱頁，篩選區塊佔了大約半個畫面（`docs/screenshots/renewlet-subscriptions-h5-en.png`）。【查證】本產品應該避免這兩種做法。【推論】
6. **每個成熟產品都有「全域預設提前天數」，本 repo 沒有。** Wallos、SubTrackr、Renewlet、RET 都在設定中有預設天數，每筆訂閱可以沿用或覆寫。本 repo 的新訂閱預設固定為「前一天」（`SubscriptionModal.tsx`）。【查證】
7. **本 repo 有兩組欄位會讓提醒在沒有提示的情況下失效或無法儲存。**
   - `hasEndDate` 取消勾選時，表單隱藏到期日並取消必填（`src/client/admin/subscriptionModal.ts:10-18`），但 API 仍要求 `expiryDate`（`src/routes/subscriptions.ts:55`）。【查證】推論儲存會回傳 400。【推論，未實測】
   - `reminderMe` 為 `0` 時，排程把它當作「不提醒」（`subscription_cron.ts:36` 的 `!reminderMe`），列表卻顯示「僅到期時提醒」（`SubscriptionTableRow.tsx:96`）。【查證】目前的選項沒有 `0`，所以只有舊資料或 API 呼叫會遇到。【推論】

### 1.2 建議的手機首頁（390px，由上到下）

| 順序 | 區塊                       | 顯示條件         | 估計高度  | 對應工作     |
| ---- | -------------------------- | ---------------- | --------- | ------------ |
| 1    | 頂部列：標題、搜尋、設定   | 一直顯示         | 56px      | —            |
| 2    | 提醒狀態列                 | 只在有問題時顯示 | 48px      | 1 不錯過提醒 |
| 3    | 花費摘要（每種貨幣一行）   | 有訂閱時         | 72–96px   | 2 掌握總花費 |
| 4    | 訂閱列表，依下次扣款日分組 | 一直顯示         | 其餘高度  | 1 不錯過提醒 |
| 5    | 已停用（折疊，只顯示數量） | 有停用項目時     | 48px      | —            |
| 6    | 右下角新增按鈕（FAB）      | 一直顯示         | 浮動 56px | 3 快速記錄   |

估計第一個畫面可以看到 7–8 筆訂閱。【推論】理由與證據見第 6 節。

### 1.3 需要產品負責人決定的項目

1. 「總花費」的定義：平均每月（年費除以 12）、本月實際扣款、或兩者都顯示（第 6.1 節）。
2. 試用中的訂閱是否計入總花費（第 6.1 節）。
3. 首頁的提醒狀態列需要儲存「上次排程執行結果」，這是新的 KV 狀態（第 6.1 節）。
4. 付款方式是否改為自由文字（第 7.1 節）。
5. 是否新增「取消期限」欄位（第 7.1 節）。
6. 是否提供 JSON 匯出（第 7.2 節）。
7. 是否提供 iCal 行事曆訂閱網址（第 7.2 節）。
8. 付款週期是否加入「週」（第 7.1 節）。

---

## 2. 本 repo 目前的首頁與欄位

### 2.1 首頁（`/admin`）

- 版面：Navbar → 搜尋卡片（搜尋框、分類下拉選單、「添加訂閱」按鈕）→ 訂閱列表。（`src/pages/Admin.tsx:14-104`）【查證】
- 排序：全部訂閱依 `expiryDate` 由近到遠。停用的訂閱沒有移到最後，只降低不透明度。（`SubscriptionTable.tsx:40-45`、`SubscriptionTableRow.tsx:55`）【查證】
- 每一列顯示：名稱、分類徽章、備註前 50 字、剩餘時間、分類（「類型」欄）、週期、到期日、開始日、提醒天數、狀態徽章、4 個按鈕（編輯、測試、刪除、停用／啟用）。（`SubscriptionTableRow.tsx:52-139`）【查證】
- 問題：
  - 不顯示價格。【查證】
  - `customType` 併入 `category` 後，分類在同一列出現兩次（名稱旁的徽章與「類型」欄）。【查證】
  - 分類字串用 `/[\\/,\s]+/` 切成多個徽章。名稱含空白的分類（例如「Apple 服務」）會被拆開。【查證】
  - 剩餘時間前面固定顯示 `triangle-alert` 警告圖示，不論狀態。【查證】
  - `btn-xs` 在 daisyUI 預設的 `--size-field` 下高度為 24px（`node_modules/daisyui/components/button.css`），低於 HIG 的 iOS 預設控制項尺寸 44×44pt 與最小 28×28pt。【查證】
  - 「測試」按鈕放在每一筆訂閱上。設定頁沒有逐一測試通知管道的按鈕（`src/pages/Config.tsx` 沒有「測試」字樣）。【查證】

### 2.2 訂閱欄位（`src/types/index.ts` 的 `Subscription`）

`name`、`category`、`currency`、`price`、`startDate`、`expiryDate`、`hasEndDate`、`autoRenew`、`isFreeTrial`、`periodValue`、`periodUnit`（day／month／year）、`periodMethod`（credit／apple／google／paypal／other，實際是付款方式）、`website`、`isReminderSet`、`reminderMe`、`notes`、`isActive`，加上系統欄位。【查證】

### 2.3 設定（`src/pages/Config.tsx`）

分頁：基本設定（帳號、密碼、時區、通知時段、提醒頻率）、通知渠道（啟用哪些渠道）、渠道配置（Telegram、Webhook、Resend、Bark 的欄位）、WebAuthn 設定。【查證】同一個渠道的「啟用」與「設定」分在兩個分頁。【查證】

---

## 3. 自架開源追蹤器

### 3.1 Wallos

**首頁（`index.php`，v4.1.0 起新增的 at-a-glance dashboard，`CHANGELOG.md:493`）**，由上到下：【查證】

1. 版本更新橫幅（只有管理員，`index.php:113-145`）
2. 問候語「Hello {名字}」（`:151`）
3. 逾期續訂：未停用、手動續訂、下次付款日已過（`:84-89`、`:158`）
4. 即將付款：依 `next_payment` 由近到遠，數量預設 3，可選 3／5／10／20（`:201`、`includes/upcoming_payments.php:3,39-60`）。可設定數量是 2026-09-08 的 5.6.0 才加入，來自使用者要求（`CHANGELOG.md:57`，issue #1186）。
5. 即將取消提醒（`:245`）
6. AI 建議（`:284`）
7. 每月預算、期間預算（`:317`、`:373`）
8. 你的訂閱：啟用數量、每月花費、每年花費（`:431`）
9. 節省：停用數量、每月與每年節省（`:469`）

手機截圖（`screenshots/wallos-dashboard-mobile-light.png`）：第一個畫面只看得到問候語、1 筆逾期、2.5 張橫向卡片與 AI 建議。每張卡片只有 logo、日期、價格，沒有名稱（有 logo 時名稱隱藏）。卡片固定 155×145px（`styles/styles.css:3604-3612`）。總額在第一個畫面之外。【查證】

**總額**：所有價格先換算成主要貨幣再加總（`includes/stats_calculations.php:198-208`，使用 Fixer API）。【查證】這與本產品「不換算匯率」的決定不同。

**訂閱列表（`subscriptions.php`）**：【查證】

- 預設排序為 `next_payment`（`:9`）。另有名稱、最近新增、價格、成員、分類、付款方式、狀態、自然排序、續訂方式（`includes/sort_options.php`）。
- 依分類、成員或付款方式排序時，插入分組標題；一次性購買固定分到「Lifetime purchases」（`includes/list_subscriptions.php:170-210`）。
- 每一列：logo（沒有 logo 時顯示名稱）、續訂方式圖示（自動或手動）、下次付款日、價格（可附原幣價格）、付款方式圖示、動作選單（編輯、刪除、複製；手機另有「續訂」）（`includes/list_subscriptions.php:216-330`）。
- 手機列表截圖是兩欄卡片，第一個畫面約 4 張（`screenshots/wallos-subscriptions-mobile-light.png`）。

**訂閱欄位（`subscriptions.php:316-554`）**：名稱、logo、價格、貨幣、每 N 個（日／週／月／年，另有一次性）、自動續訂、開始日、下次付款日、付款方式、付款人（家庭成員）、分類、啟用通知、提前 N 天（`-1` 沿用設定，0–180）、取消提醒日、網址、備註（支援 Markdown 工具列）、停用、被哪個訂閱取代。沒有免費試用欄位（全部 PHP 檔案沒有 `trial` 字樣）。【查證】

**設定（`settings.php`）**：每月預算、期間預算（`:84-150`）、家庭成員（`:151`）、通知（全域提前 0–7 天、期間摘要、10 種以上管道，每種都有「Test」按鈕，`:500-1020`）、分類（`:1023`）、貨幣（`:1120`）、Fixer API key（`:1227`）、Google 搜尋 logo（`:1304`）、AI 建議（`:1345`）、付款方式（`:1442`）、主題與自訂 CSS（`:1536`）、顯示設定（每月價格、換算貨幣、顯示原價、首頁即將付款數量、手機底部導覽列、訂閱進度、週日為一週開始、停用項目排到最後、隱藏停用項目，`:1668-1750`）、實驗性設定。帳號頁另有 JSON／CSV 匯出、TOTP、API key（`profile.php`）。【查證】

**提醒排程**：固定每天 09:00（容器時區）執行（`cronjobs:5`），使用者不能設定時間。只在「剩餘天數等於設定天數」的那一天發送（`endpoints/cronjobs/sendnotifications.php:372-384`），當天排程沒有執行就不會補發。【查證】

### 3.2 SubTrackr

**首頁（`templates/dashboard.html`）**：4 張統計卡（每月花費、每年花費、啟用數量、取消後的每月節省，`:177-225`）→ 分類花費圖（`:239`）→ 全部訂閱（`:270`）。首頁沒有「即將續訂」區塊；「upcoming renewals」只是 analytics 頁的一個數字（`templates/analytics.html:240-242`）。【查證】

**列表每一列（`templates/dashboard.html:277-305`）**：icon 或狀態圓點、名稱、「分類 • 狀態」、價格（可附換算後價格）、週期。沒有日期。【查證】

**訂閱欄位（`internal/models/subscription.go:11-45`）**：名稱、Label（同一服務的多個訂閱）、金額、原幣、週期（Daily／Weekly／Monthly／Quarterly／Annual）與間隔、狀態（Active／Cancelled／Paused／Trial）、分類、標籤、付款方式（文字）、Autopay、帳戶、開始日、續訂日、取消日、網址、icon 網址、備註、使用頻率（High／Medium／Low／None）、分攤人數、取消通知期（續訂前幾天必須取消）、提醒開關。【查證】

**設定（`templates/settings.html`、`web/locales/en.json`）**：續訂提醒（單一天數，或逗號分隔的多個天數如 `7,3,0`，`en.json:166-168`）、取消提醒與天數、高額訂閱警示、SMTP、Pushover、Webhook、Telegram（都有測試按鈕）、貨幣、日期格式、語言、主題、分類、API key、iCal 訂閱網址、CSV／JSON 匯出、備份與還原、從 Wallos 匯入、登入開關。【查證】

**提醒排程**：服務啟動 30 秒後執行一次，之後每 24 小時執行一次（`cmd/server/main.go:520-545`）。發送時間取決於服務啟動時間，使用者不能設定。【查證】

### 3.3 Renewlet

**首頁（`apps/web/src/pages/dashboard.tsx`）**：【查證】

1. 4 張統計卡：每月花費（以即時匯率換算成預設貨幣）、啟用數量、即將續費數量、試用數量（`:138-179`）。手機上每月花費與試用卡佔滿整行，另外兩張並排（`components/dashboard-stat-layout.ts`）。
2. 最近訂閱：前 6 筆卡片（`:130`、`:184-240`）。
3. 側欄：支出分布圓環圖（`:247-258`）、即將續費清單（`:261-265`）。

外層是 `grid lg:grid-cols-3`，寬度小於 `lg` 時為單欄，DOM 順序讓「即將續費」排在手機頁面的最後。【查證】即將續費清單只列出在各訂閱提醒窗口內的項目，最多 5 筆，3 天內以警告色標示（`components/upcoming-renewals.tsx:28,43`、`modules/subscriptions/domain/upcoming-reminders.ts:38-39`）。【查證】

**卡片內容**（`docs/screenshots/renewlet-dashboard-en.png`）：logo、名稱、價格與週期（「$16 Monthly」）、分類、狀態、續訂方式、開始日、到期日、付款方式、「Renews in 13 days」。【查證】手機版訂閱頁的篩選區塊（搜尋、分類、狀態、續訂方式、排序、標籤）佔第一個畫面約一半，只露出 2 張卡片（`docs/screenshots/renewlet-subscriptions-h5-en.png`）。【查證】

**訂閱欄位（`packages/shared/src/schemas/subscriptions.ts:214-247`、`packages/shared/src/runtime.ts:19-37`）**：名稱、logo、價格、貨幣、週期（weekly、monthly、quarterly、semi-annual、annual、custom、one-time）、分類、狀態（trial、active、expired、paused、cancelled）、置頂、公開頁隱藏、付款方式（文字，最多 80 字）、開始日、下次扣款日、自動續訂、自動計算下次扣款日、**試用結束日**、網站、備註、標籤、提前天數（停用／沿用／自訂）、重複提醒（間隔 1–24 小時，窗口 24 小時到整段）、費用分攤。【查證】

**設定（`packages/shared/src/schemas/settings.ts:102-165`）**：主題、語言、顯示已過期、農曆、預設貨幣、匯率來源、icon 來源、每月預算、**時區、每日通知時間（HH:MM）、全域提前天數**、啟用的管道與 10 種管道的欄位。【查證】

**提醒排程**：Cloudflare Worker Cron 每分鐘執行，依使用者時區判斷是否到了通知時間，由 `notification_jobs` 保證同一次只發送一次（`wrangler.jsonc:34-37`）。【查證】這與本 repo 已決定的「每日提醒時間 + 時區」相同方向，而且同樣在 Workers 上執行。

### 3.4 Recurring Expense Tracker（RET）

**首頁**（`fastlane/metadata/android/en-US/images/phoneScreenshots/01.png`）：頂部是 Monthly／Weekly／Yearly 三個總額，下面是訂閱卡片（名稱、標籤、月均價格、原始價格與週期如「$399.00 / 1 Y」）。底部導覽：Home、Upcoming、Settings。【查證】

**Upcoming 分頁（`shared/.../ui/upcomingexpenses/UpcomingPaymentsScreen.kt:134-190`）**：依月份分組，月份標題顯示「本月剩餘應付金額」；每筆顯示「today／tomorrow／in N days／N days overdue」，可以標記為已付款，已付款項目另外分組（`composeResources/values/strings.xml:74-86`）。【查證】另有 Android 桌面小工具，列出名稱、價格、日期（`phoneScreenshots/03.png`）。【查證】

**設定（`shared/.../ui/settings/SettingsMainScreen.kt:121-260`）**：主題、**預設分頁（Home 或 Upcoming）**、Upcoming 顯示範圍（1 個月到 10 年）、標籤、預設貨幣、顯示換算貨幣、生物辨識鎖、通知（開關、**通知時間**、**提前天數**）、備份與還原。【查證】

「預設分頁」的存在表示有使用者希望打開 app 直接看到即將付款的清單。【推論】

### 3.5 Firefly III（相鄰參考）

Firefly III 的 subscription 有最低與最高金額（圖表用平均值）、重複頻率、第一次預計日期、跳過次數、可選的結束日與延長日。首頁有一個區塊顯示「預計平均金額」與「已支付金額」。（[How to use subscriptions](https://docs.firefly-iii.org/how-to/firefly-iii/finances/subscriptions/)）【查證】它是記帳軟體，以實際交易比對為主，欄位設計不適合本產品。【推論】

### 3.6 首頁組成比較

| 產品         | 手機第一個畫面的主角        | 即將扣款的位置        | 總額                   | 列表每列的日期          |
| ------------ | --------------------------- | --------------------- | ---------------------- | ----------------------- |
| 本 repo      | 搜尋區塊、1–2 筆訂閱        | 列表依到期日排序      | 沒有                   | 絕對日期 + 剩餘時間     |
| Wallos       | 問候語、逾期、橫向 3 張卡片 | 第 2 區塊（逾期之後） | 換算成主要貨幣，在下方 | 絕對日期                |
| SubTrackr    | 4 張統計卡                  | 首頁沒有              | 換算後，放在最上方     | 沒有                    |
| Renewlet     | 4 張統計卡                  | 手機頁面最後          | 換算後，放在最上方     | 絕對日期 + 相對天數     |
| RET          | 3 個總額 + 訂閱卡片         | 另一個分頁            | 換算後，放在最上方     | Upcoming 分頁有相對天數 |
| Rocket Money | —                           | Recurring 分頁預設    | 說明文件未提及         | 依預計扣款日排序        |

---

## 4. 商業產品與平台

### 4.1 Bobby（iOS，Yummygum）

- App Store 說明：「Bobby provides a clear overview of all your subscriptions and upcoming bills. This way you'll always know the amount of money spent on subscriptions」；「Bobby also notifies you when a bill is due」。([App Store](https://apps.apple.com/us/app/bobby-track-subscriptions/id1059152023)）【查證】
- 欄位：Color、First Bill、Cycle、Duration、Remind Me、Currency 都用選擇器輸入；提醒可以設為當天或提前 1–30 天／週／月／年。評論者建議不要選當天，因為可能來不及取消。列表顯示距離續訂的時間（「6 months, 4 days, 3 weeks」）。評論者希望知道每個金額是每月還是每年。（[Rhymes With Diploma, 2020-02-07](https://rhymeswithdiploma.com/2020/02/07/tracking-subscriptions/)）【次要來源】
- 對本產品的意義：列表的金額必須附上週期（「/月」「/年」）。【推論】

### 4.2 Rocket Money

- Recurring 分頁有三種檢視：Upcoming（預設）上方是日曆，下方是「a list of upcoming bills sorted by date of expected charge」；All 依字母排序，可以看到停用項目；Calendar。（[Where can I view my subscriptions and bills?](https://help.rocketmoney.com/en/articles/3117398-where-can-i-view-my-subscriptions-and-bills)）【查證】
- 可以修改下次扣款日與金額。（[Managing your bills and subscriptions](https://help.rocketmoney.com/en/articles/2185531-managing-your-bills-and-subscriptions)）【查證】
- Rocket Money 以銀行帳戶自動偵測訂閱，這部分不適用本產品。【推論】

### 4.3 Apple 訂閱管理

- 設定 → 名字 → 訂閱。點「使用中」的訂閱可以變更或取消，點「已過期」的訂閱可以續訂；可以開啟「續訂收據電子郵件」。（[See your purchases and subscriptions](https://support.apple.com/guide/iphone/see-your-purchases-and-subscriptions-iph4e3e7324f/ios)）【查證】
- 「If you signed up for a trial subscription and you don't want to renew it, cancel it at least 24 hours before the trial ends.」（[Cancel a subscription from Apple](https://support.apple.com/en-us/118428)）【查證】
- 對本產品的意義：試用的提醒不能只在結束當天送出；「使用中」與「已停用」應該分成兩群。【推論】

### 4.4 Google Play

- 「If you accept a trial offer, you'll get an email when your trial is about to end.」「At the end of your trial period, the first billing period begins and you automatically get charged」。（[Subscribe to services or content](https://support.google.com/googleplay/answer/2476088)）【查證】
- 列表每筆顯示哪些資料，說明文件沒有寫。【未知】

### 4.5 未查證的產品

Subby、Tilla、Chronicle 等 app 沒有找到可以引用的官方文件，本文沒有使用它們。

---

## 5. UX 研究與平台指引

1. **監看型 dashboard 要把時間敏感的資訊放前面。** NN/g 把 dashboard 分成 operational（時間敏感、要馬上處理）與 analytical（分析，沒有時間壓力），並定義 dashboard 是「at-a-glance information on which users can act quickly」。（[Laubheimer, 2017-06-18](https://www.nngroup.com/articles/dashboards-preattentive/)）【查證】扣款前取消是時間敏感的工作，屬於 operational。【推論】
2. **不要用圓餅圖或圓環圖。** 同一篇文章：圓餅圖與圓環圖「should be avoided most of the time」，改用長度與 2D 位置（長條圖）。【查證】Renewlet 與 SubTrackr 首頁都用了圓環圖或分類圖。【查證】
3. **同質項目用垂直列表，不用卡片。** 「A standard vertical list view … is more scannable than cards because the positioning of the individual elements is fixed in size and more predictable for the eye.」卡片比一行文字大，同一個畫面放得比較少。（[Cards: UI-Component Definition, 2016-11-06](https://www.nngroup.com/articles/cards-component/)）【查證】訂閱是同質項目，價格與日期要能上下比對。【推論】
4. **依重要性由上到下排列，並減少畫面上的控制項。** HIG Layout：「place the most important items near the top and leading side」、使用 progressive disclosure 減少一開始顯示的內容。HIG Designing for iOS：「limiting the number of onscreen controls while making secondary details and actions discoverable with minimal interaction」，且手指比較容易碰到畫面中段與下方的控制項，列表列可以用滑動執行動作。（[Layout](https://developer.apple.com/design/human-interface-guidelines/layout)、[Designing for iOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios)）【查證】
5. **列表列的文字要短。** HIG Lists and tables：「Keep item text succinct so row content is comfortable to read」；內容多時只列標題，點進去看詳細內容；grouped 樣式用標題與間距分群。（[Lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)）【查證】
6. **觸控目標。** HIG Accessibility：iOS 預設控制項尺寸 44×44pt，最小 28×28pt。（[Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)）【查證】
7. **FAB 放畫面上最重要的一個動作。** Material：「FAB represents the most important action on a screen. It puts key actions within reach.」（[material-web docs/components/fab.md](https://github.com/material-components/material-web/blob/main/docs/components/fab.md)）【查證】本產品的第三個工作是快速新增，新增是首頁最常用的動作。【推論】
8. **逾期項目和今天的項目放在一起。** Apple 提醒事項的「今天」智慧型列表：「Items scheduled for today and overdue items」。（[Use Smart Lists in Reminders](https://support.apple.com/guide/iphone/use-smart-lists-iphe882772ed/ios)）【查證】Wallos 也把逾期放在即將付款之前。【查證】
9. **相對時間與絕對日期。** NN/g 的首頁指引要求新聞文章不要寫「today」「next week」，理由是內容之後會被搜尋與快取（[113 Design Guidelines for Homepage Usability](https://www.nngroup.com/articles/113-design-guidelines-homepage-usability/)，guideline 84）。【查證】這條指引針對會被存檔的文章，不直接適用於即時計算的 app。Renewlet 與 RET 都同時顯示相對天數與日期。【查證】本產品建議兩者都顯示：相對天數用於判斷急迫性，日期用於對照信用卡帳單。【推論】

沒有找到 NN/g 或 Baymard 針對「本週／本月」時間分組列表的研究。第 6.3 節的分組方式是推論。

---

## 6. 建議的首頁組成

### 6.1 手機（390px），由上到下

**1. 頂部列（約 56px）**

- 左：頁面名稱。右：搜尋圖示、設定圖示。
- 登出、主題切換、使用者名稱移到設定頁。
- 理由：HIG 建議減少畫面上的控制項（第 5 節第 4 點）。【推論】

**2. 提醒狀態列（只在有問題時顯示，約 48px）**

- 顯示條件：沒有啟用任何通知管道；上一次排程發送失敗；（提醒時間改版後）尚未設定提醒時間。
- 內容：一句話說明問題，點擊前往設定。
- 理由：PRODUCT.md 原則 1「任何設定都不能在沒有提示的情況下讓提醒停止」。目前的排程失敗只寫 log（`subscription_cron.ts` 的 `logger.error`），使用者看不到。【查證】
- 需要決定：要顯示「上次發送失敗」，排程必須把執行結果寫進 KV。這是新的持久狀態。【推論】

**3. 花費摘要（約 72–96px）**

- 每種貨幣一行，例如「NT$ 1,280 /月　年 NT$ 15,360」。
- 只加總「使用中」且非停用的訂閱。年費、日費換算成每月是同一貨幣內的算術，不涉及匯率。
- 超過 3 種貨幣時，顯示前 3 種，其餘折疊成「另 N 種貨幣」。【推論】
- 放在列表之前的理由：摘要高度固定，列表長度不固定。放在列表之後，訂閱一多就被推到畫面外。Renewlet 把「即將續費」放在長內容之後，手機上就排到最後（第 3.3 節）。【推論】
- 不用統計卡：SubTrackr 與 Renewlet 的 4 張卡片在手機上佔 2–3 行，其中「啟用數量」與使用者的三個工作無關。【推論】
- 需要決定：
  - 「每月」是平均值（年費 ÷ 12）還是本月實際扣款。平均值適合比較，實際扣款適合對照帳單。建議主數字用平均值並標示「平均每月」，本月實際扣款放在列表分組標題（見下方）。【推論】
  - 試用中的訂閱是否計入。Renewlet 把試用另外計數（第 3.3 節）。建議不計入，在摘要下方寫「另有 N 筆試用中」。【推論】

**4. 訂閱列表（其餘高度）**

- 單一垂直列表，不用卡片，不用橫向捲動（第 5 節第 3 點；Wallos 的橫向卡片見第 3.1 節）。
- 依下次扣款日由近到遠排序（Wallos 預設、Rocket Money Upcoming、本 repo 目前都是這個順序）。【查證】
- 分組見第 6.3 節，列的結構見第 6.2 節。
- 不在列表上方放搜尋框與篩選。搜尋放在頂部列的圖示，點開後才顯示搜尋框與分類篩選。理由：Renewlet 的篩選區塊佔半個畫面（第 3.3 節），本 repo 的搜尋卡片也在列表之前（第 2.1 節）；個人訂閱數量通常不多，捲動就能找到。【推論】

**5. 已停用（折疊）**

- 列表最後一行「已停用（3）」，點擊展開。
- 理由：Apple 把使用中與已過期分開（第 4.3 節）；Wallos 用兩個設定（排到最後、隱藏）處理同一件事（第 3.1 節）。用固定行為取代設定，符合 PRODUCT.md 原則 2。【推論】

**6. 新增按鈕（FAB，右下角）**

- 56px 圓形按鈕，位置避開底部安全區域，列表底部留出同樣高度的空白，避免遮住最後一列。
- 理由：第 5 節第 4、7 點；PRODUCT.md 原則 3「手機上單手可完成」。【推論】

**空狀態**：一句說明與一個「新增訂閱」按鈕。Wallos 對沒有訂閱的新使用者直接導向訂閱頁（`CHANGELOG.md:485`）。【查證】

**估計第一個畫面**：844px − 狀態列 47 − 頂部列 56 − 摘要 88 − 2 個分組標題 64 ≈ 589px，以每列 64–72px 計算約 8 筆。【推論，未實測】

### 6.2 列表列的結構（兩行，約 64px）

```
┌──────────────────────────────────────────────┐
│ Netflix                          NT$ 390 /月 │  第 1 行：名稱（粗體，單行截斷）｜金額與週期
│ 試用 · 串流媒體                   3 天後 · 10/02 │  第 2 行：例外標記、分類｜相對天數、日期
└──────────────────────────────────────────────┘
```

- 金額一定附週期：Bobby 的評論者抱怨看不出金額是每月還是每年（第 4.1 節）；Renewlet（「$16 Monthly」）與 RET（「$399.00 / 1 Y」）都附週期。【查證】
- 金額與日期靠右對齊並使用等寬數字，方便上下比對（第 5 節第 3 點）。【推論】
- 標記只在例外時出現：「試用」「手動續訂」「未設提醒」。一般的訂閱沒有徽章。理由：使用者不接受過度裝飾；HIG 要求列表文字簡短。【推論】
- 在提醒窗口內的項目，只把第 2 行右側文字改成警告色，不改整列背景。Renewlet 對 3 天內的項目加警告色邊框（第 3.3 節）。【查證】
- 列上沒有按鈕。點擊整列開啟編輯畫面（手機上為全螢幕），停用、刪除、「已續訂」放在編輯畫面。理由：HIG 建議把次要動作放在一次操作後可以找到的位置；目前 24px 的按鈕低於 HIG 最小尺寸（第 2.1 節、第 5 節第 4、6 點）。【推論】
- 不在列上顯示：備註、開始日、提醒天數、網站、付款方式（桌機才顯示付款方式）。【推論】

### 6.3 分組與排序

| 分組           | 內容                                   | 標題右側       |
| -------------- | -------------------------------------- | -------------- |
| 需要處理       | 已過下次扣款日、手動續訂、未停用的訂閱 | 筆數           |
| 7 天內         | 7 天內扣款                             | 每種貨幣的小計 |
| 30 天內        | 8–30 天內扣款                          | 每種貨幣的小計 |
| 之後           | 30 天以後                              | 不顯示小計     |
| 已停用（折疊） | `isActive = false`                     | 筆數           |

- 「需要處理」的來源：Wallos 的「Overdue Renewals」（`index.php:84-89`）與 Apple 提醒事項「今天」包含逾期項目（第 5 節第 8 點）。【查證】本 repo 的自動續訂在排程中推算下一期，所以只有手動續訂的訂閱會停在過期狀態（`src/services/subscription.ts:112-137`）。【查證】
- 分組標題的小計來源：RET 的月份標題顯示本月剩餘應付金額（第 3.4 節）。【查證】小計只加總同一貨幣。
- 7 天與 30 天的界線：本 repo 的提前天數選項從 1、3、7 開始；Renewlet 的統計卡字串使用「next 7 days」。【查證】界線本身沒有研究證據。【推論】
- 空的分組不顯示標題。【推論】

### 6.4 桌機寬度（≥1024px）增加的內容

PRODUCT.md 規定「桌機是放大的版本，不是另一套流程」。順序與手機相同，只增加欄位與側欄。【推論】

- 兩欄：左側 2/3 是同一份分組列表，右側 1/3 是固定位置的側欄。Renewlet 用相同的 `lg:grid-cols-3` 分配（第 3.3 節）。【查證】
- 列表變成單行多欄：名稱、分類、付款方式、週期、金額、下次扣款日、提醒。仍然沒有每列按鈕，滑鼠移上去時才顯示「編輯」。【推論】
- 側欄由上到下：
  1. 花費摘要（從列表上方移到側欄）。
  2. 每種貨幣各自的「分類每月花費」長條圖，不用圓環圖（第 5 節第 2 點）。
  3. 提醒狀態：每日提醒時間、時區、啟用的管道、上次執行時間與結果。
- 頂部列直接顯示搜尋框與「新增訂閱」按鈕，不用 FAB。【推論】

### 6.5 不放在首頁的內容

| 內容           | 其他產品            | 不放的理由                                             |
| -------------- | ------------------- | ------------------------------------------------------ |
| 問候語         | Wallos              | 佔一整行，與三個工作無關。【推論】                     |
| 啟用數量統計卡 | SubTrackr、Renewlet | 同上。【推論】                                         |
| 預算與超支     | Wallos、Renewlet    | 需要單一貨幣的總額，與不換算匯率衝突。【推論】         |
| 節省金額       | Wallos、SubTrackr   | 需要記錄取消歷史，與三個工作無關。【推論】             |
| AI 建議        | Wallos、Zublo       | 需要外部 API key，PRODUCT.md 不引入。【查證】          |
| 分類圓環圖     | Renewlet、SubTrackr | NN/g 不建議；手機上佔空間。【查證】                    |
| 版本更新橫幅   | Wallos              | 部署在使用者自己的 Workers，由部署者自己升級。【推論】 |

---

## 7. 設定與欄位差異表

優先度：**P1** 直接影響三個工作或原則 1；**P2** 改善速度或正確性；**P3** 可以之後再做。

### 7.1 訂閱欄位

| 項目                                   | 本 repo                                                | 其他產品                                                                   | 建議                                         | 理由                                                                                                                      | 優先度 |
| -------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| 名稱                                   | 有                                                     | 全部都有                                                                   | 保留                                         | —                                                                                                                         | —      |
| 價格、貨幣                             | 有，但列表不顯示                                       | 全部都有，列表都顯示價格                                                   | 保留，列表顯示金額與週期                     | 工作 2；第 6.2 節                                                                                                         | P1     |
| 下次扣款日（`expiryDate`）             | 有，標籤為「到期日期」                                 | Wallos `next_payment`、Renewlet `nextBillingDate`、SubTrackr `RenewalDate` | 保留，標籤改為「下次扣款日」                 | 自動續訂的訂閱不會「到期」，「到期」讓人誤解。【推論】                                                                    | P2     |
| 付款週期                               | 每 N 天／月／年                                        | Wallos、SubTrackr、Renewlet、RET、Bobby 都有「週」                         | 需要決定是否加入「週」                       | 五個產品都有；個人訂閱以月與年為主，週付較少。【推論】                                                                    | P3     |
| 一次性購買                             | 沒有                                                   | Wallos、Renewlet 有                                                        | 不新增                                       | 沒有續訂，不需要提醒，也不算入每月花費。【推論】                                                                          | —      |
| `hasEndDate`                           | 有                                                     | 沒有產品有相同欄位；其他產品用自動續訂或狀態表示                           | 移除                                         | 取消勾選後表單不要求到期日，API 仍要求（第 1.1 節第 7 點）。「自動續訂」關閉已經表示「到期後不自動延長」。                | P1     |
| 自動續訂                               | 有                                                     | Wallos、SubTrackr（Autopay）、Renewlet 有                                  | 保留，並新增「已續訂」動作                   | 手動續訂過期後目前只能手動改日期。Wallos 手機版有「續訂」、Renewlet 有 renew、RET 有「標記為已付款」（第 3 節）。【查證】 | P1     |
| 免費試用                               | 只有 `isFreeTrial` 旗標，沒有作用                      | Renewlet 有試用結束日與 trial 狀態；SubTrackr 有 Trial 狀態；Wallos 沒有   | 保留並讓它生效                               | 工作 1。見下方「試用」說明。                                                                                              | P1     |
| 取消期限                               | 沒有                                                   | Wallos 取消提醒日、SubTrackr 取消通知期                                    | 需要決定                                     | Apple 要求試用結束前 24 小時取消（第 4.3 節）。「提前天數」已可涵蓋大部分情況。【推論】                                   | P3     |
| 提醒（`isReminderSet` + `reminderMe`） | 兩個欄位，選項 1、3、7、14、21、30、60、90 天          | Wallos `-1` 沿用設定；Renewlet 停用／沿用／自訂                            | 合併成一個選單：「不提醒」「沿用預設」與天數 | 兩個欄位表達同一件事；`0` 的意義在排程與列表不一致（第 1.1 節第 7 點）。                                                  | P1     |
| 分類                                   | 自由文字，列表依空白與符號拆成多個徽章                 | Wallos 由設定管理的清單；Renewlet 必填單一分類；SubTrackr 單一分類另加標籤 | 保留單一分類，不拆字串，輸入時提示既有分類   | 拆字串會把「Apple 服務」拆成兩個。【查證】提示既有分類可以避免同義不同字。【推論】                                        | P2     |
| 標籤                                   | 沒有                                                   | SubTrackr、Renewlet、RET 有                                                | 不新增                                       | 已有單一分類；多一個分類維度與三個工作無關。【推論】                                                                      | —      |
| 付款方式（`periodMethod`）             | 固定 5 種：信用卡、Apple Pay、Google Pay、PayPal、其他 | Wallos 可自訂清單；SubTrackr 自由文字另有帳戶欄；Renewlet 自由文字         | 需要決定是否改成自由文字並提示既有值         | 「信用卡」無法分辨是哪一張卡；對帳單時需要卡名。【推論】欄位名稱 `periodMethod` 與內容不符。【查證】                      | P3     |
| 開始日                                 | 有，選填                                               | Wallos、SubTrackr、Renewlet 有                                             | 保留，移到表單的「更多」區塊                 | 不影響提醒與總額。【推論】                                                                                                | P3     |
| 網站                                   | 有                                                     | Wallos、SubTrackr、Renewlet 有                                             | 保留，在編輯畫面顯示為「前往網站」連結       | 收到提醒後要去取消時使用。【推論】                                                                                        | P3     |
| 備註                                   | 有，列表顯示前 50 字                                   | 全部都有                                                                   | 保留，列表不顯示                             | HIG：列表文字簡短（第 5 節第 5 點）。                                                                                     | P3     |
| 停用（`isActive`）                     | 有                                                     | Wallos inactive、SubTrackr／Renewlet 的狀態                                | 保留，移到編輯畫面，列表最後折疊             | 第 6.1 節。                                                                                                               | P2     |
| Logo                                   | 沒有                                                   | Wallos、SubTrackr、Renewlet 有，含網路搜尋                                 | 不新增                                       | 使用者不接受過度裝飾；Wallos 有 logo 時在手機上隱藏名稱。【查證】                                                         | —      |
| 付款人、家庭成員、分攤                 | 沒有                                                   | Wallos 家庭成員、SubTrackr 分攤人數、Renewlet 費用分攤                     | 不新增                                       | PRODUCT.md 原則 2「只有一個使用者」。                                                                                     | —      |
| 使用頻率、取代訂閱、置頂               | 沒有                                                   | SubTrackr 使用頻率、Wallos 取代訂閱、Renewlet 置頂                         | 不新增                                       | 與三個工作無關。【推論】                                                                                                  | —      |

**試用的具體建議**【推論，依據第 3.3、4.3、4.4 節】：

- 勾選「免費試用」時，「下次扣款日」的標籤改為「試用結束日」，價格欄的說明改為「試用後的價格」。
- 列表顯示「試用」標記。
- 通知標題改為「免費試用即將結束：{名稱}」，內容寫出試用後的價格與扣款日。目前的通知內容只有名稱與日期（`notifier/index.ts:145-146`）。【查證】
- 勾選試用時，提前天數預設至少 2 天。理由：Apple 要求結束前 24 小時取消，提醒時間又固定在每天某個時段。
- 試用結束且自動續訂時，排程推算下一期並清除試用旗標。這個行為需要與產品負責人確認。

### 7.2 設定項目

| 項目                                                                                       | 本 repo                                | 其他產品                                                                                                      | 建議                                             | 理由                                                                                                 | 優先度 |
| ------------------------------------------------------------------------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------ |
| 每日提醒時間 + 時區                                                                        | 已決定改版                             | Renewlet：時區 + HH:MM + 每分鐘 Cron + 發送紀錄防重複；RET：通知時間；Wallos 固定 09:00；SubTrackr 依啟動時間 | 依已決定的方向實作                               | Renewlet 在 Workers 上用相同做法（第 3.3 節）。【查證】                                              | P1     |
| 全域預設提前天數                                                                           | 沒有                                   | Wallos、SubTrackr、Renewlet、RET 都有                                                                         | 新增                                             | 新增訂閱時少選一次；每筆訂閱可以沿用或覆寫。工作 3。                                                 | P1     |
| 提醒頻率（只提醒一次／每天）                                                               | 有                                     | Renewlet 重複提醒；SubTrackr 多個提醒天數                                                                     | 保留，選項文字改短                               | 「每天」已經涵蓋多次提醒的需要。【推論】                                                             | P2     |
| 通知管道：啟用與欄位                                                                       | 分在「通知渠道」與「渠道配置」兩個分頁 | Wallos 每個管道一個區塊，含啟用與測試；SubTrackr 每個管道有測試按鈕                                           | 合併成每個管道一張卡片：開關、欄位、「傳送測試」 | 使用者在同一處完成設定與確認。原則 1。                                                               | P1     |
| 測試通知                                                                                   | 每一筆訂閱有「測試」按鈕               | Wallos、SubTrackr 放在管道設定                                                                                | 從列表移除，改放在每個管道                       | 測試的是管道，不是訂閱。【推論】                                                                     | P1     |
| Webhook 方法、標頭、內容範本；Bark 歷史與查詢參數；寄件人名稱                              | 有                                     | Renewlet、Wallos 有相同或更多選項                                                                             | 保留，放在各管道的「進階」折疊區塊               | 使用者自己設定的管道需要這些欄位；預設值可用時不需要展開。原則 2。【推論】                           | P3     |
| 管理員帳號、密碼                                                                           | 有                                     | 全部都有                                                                                                      | 保留                                             | —                                                                                                    | —      |
| Passkey                                                                                    | 有                                     | Renewlet 有                                                                                                   | 另見 passkey 研究                                | 不在本文範圍。                                                                                       | —      |
| 主題                                                                                       | Navbar 上的切換                        | 全部都有                                                                                                      | 保留，預設跟隨系統，切換移到設定頁               | 減少首頁控制項（第 5 節第 4 點）。【推論】                                                           | P3     |
| 預設貨幣                                                                                   | 表單固定預選 TWD                       | Wallos、SubTrackr、Renewlet、RET 都有，主要用於匯率換算                                                       | 不新增設定；預選上一次使用的貨幣                 | 本產品不換算匯率，預設貨幣只影響表單。【推論】                                                       | P3     |
| 匯率換算                                                                                   | 沒有                                   | 全部都有                                                                                                      | 不新增                                           | 已決定。                                                                                             | —      |
| 預算                                                                                       | 沒有                                   | Wallos、Renewlet 有；SubTrackr 有高額警示                                                                     | 不新增                                           | 需要單一貨幣總額。                                                                                   | —      |
| 顯示設定（每月價格、首頁數量、隱藏停用、停用排最後、預設分頁、顯示範圍、進度條、週起始日） | 沒有                                   | Wallos 9 項、RET 2 項、Renewlet 顯示已過期                                                                    | 不新增，用固定行為                               | 原則 2「能用安全的預設值取代時，就不顯示」。第 6 節已決定這些行為。                                  | —      |
| 語言                                                                                       | 只有繁體中文                           | 其他都有多語言                                                                                                | 不新增                                           | PRODUCT.md 規定只有繁體中文（台灣）。                                                                | —      |
| 匯出、備份                                                                                 | 沒有                                   | Wallos JSON／CSV；SubTrackr CSV／JSON／備份還原；RET 備份還原；Renewlet 匯入匯出                              | 需要決定；建議只做 JSON 匯出                     | 資料在使用者自己的 KV，但使用者無法在 app 內取得完整副本。唯讀匯出的風險低。【推論】                 | P3     |
| iCal 行事曆                                                                                | 沒有                                   | Wallos 匯出；SubTrackr 可訂閱網址；Renewlet 日曆訂閱                                                          | 需要決定；目前不建議                             | 可以作為第二個提醒來源，但需要一個公開的帶 token 網址，這是剛移除 `API_TOKEN` 的同一類設計。【推論】 | —      |
| API key、OIDC、TOTP、AI、logo 搜尋、MCP、公開狀態頁                                        | 沒有                                   | 各產品不同程度都有                                                                                            | 不新增                                           | 原則 2：不為第三方整合設計設定。                                                                     | —      |
| 登出                                                                                       | Navbar                                 | —                                                                                                             | 移到設定頁                                       | 減少首頁控制項。【推論】                                                                             | P3     |

### 7.3 設定頁的結構

建議把目前的 4 個分頁改成一頁，依重要性由上到下分段：【推論】

1. **提醒**：每日提醒時間、時區、預設提前天數、提醒頻率。
2. **通知管道**：每個管道一張卡片（開關、必要欄位、進階折疊、「傳送測試」）。沒有啟用任何管道時，這一段最上方顯示警告。
3. **帳號與登入**：使用者名稱、密碼、passkey、登出。
4. **外觀**：主題。

理由：

- 提醒與管道決定原則 1，放在最前面。
- 分頁在手機上把相關設定拆開（目前「啟用」與「欄位」在不同分頁，第 2.3 節）。
- HIG 說 iOS 設定用「a hierarchy of lists」（第 5 節第 5 點的同一頁）。管道欄位多時，可以改成列表項目點進子頁面。【推論】
- 介面用語：程式碼與目前介面用「渠道」，台灣慣用「管道」。建議介面改用「通知管道」。【推論】

---

## 8. 未決問題與未知事項

- **沒有實測本 repo 的首頁。** 第 1.1 節第 2 點與第 6.1 節的畫面高度是依 class 名稱估算，沒有在 390px 瀏覽器中量測。
- **`hasEndDate` 儲存失敗是推論。** 依表單與 API schema 推導，沒有實際送出。
- **Bobby 的首頁內容只來自 App Store 說明與一篇 2020 年的第三方評論。** 目前版本（3.10.4）的首頁總額與排序方式沒有查證。
- **Rocket Money 是否在 Recurring 分頁顯示總額，說明文件沒有寫。**
- **Apple 與 Google Play 訂閱列表每一列顯示的欄位，官方文件沒有寫。**
- **Material 3 lists 規格頁（m3.material.io）是 JavaScript 網頁，無法擷取。** 本文沒有引用列表列高度的官方數值。
- **沒有使用者測試資料。** 所有排序、分組界線（7 天、30 天）與列的結構都需要在實作後以 `docs/dogfood.md` 的流程確認。
- **Subby、Tilla、Chronicle 沒有查證。**

---

## 9. 來源

### 本機檔案（本 repo，`c968d4b`）

- `PRODUCT.md`
- `src/pages/Admin.tsx`、`src/pages/Config.tsx`
- `src/components/admin/SubscriptionTable.tsx`、`SubscriptionTableRow.tsx`、`SubscriptionModal.tsx`、`utils.ts`
- `src/client/admin/subscriptionModal.ts`
- `src/types/index.ts`、`src/utils/constants.ts`
- `src/routes/subscriptions.ts`
- `src/services/subscription.ts`、`src/services/subscription_cron.ts`、`src/services/notifier/index.ts`
- `node_modules/daisyui/components/button.css`（daisyUI 5.7.46）

### 開源專案

- Wallos：<https://github.com/ellite/Wallos/tree/844cea04e3025f75494e954aaa67af7386d4840a>
  - `index.php`、`subscriptions.php`、`settings.php`、`profile.php`、`cronjobs`
  - `includes/upcoming_payments.php`、`includes/list_subscriptions.php`、`includes/sort_options.php`、`includes/stats_calculations.php`、`includes/i18n/en.php`
  - `endpoints/cronjobs/sendnotifications.php`、`styles/styles.css`、`CHANGELOG.md`、`migrations/`
  - `screenshots/wallos-dashboard-mobile-light.png`、`screenshots/wallos-subscriptions-mobile-light.png`
- SubTrackr：<https://github.com/bscott/subtrackr/tree/cf0d591ee0257c8dcaf90a20dd0a502bdc076dc5>
  - `README.md`、`templates/dashboard.html`、`templates/settings.html`、`templates/analytics.html`
  - `internal/models/subscription.go`、`internal/models/settings.go`、`web/locales/en.json`、`cmd/server/main.go`
- Renewlet：<https://github.com/zhiyingzzhou/renewlet/tree/e7ae44aed1e749b2e43ed60b56738319afe16d50>
  - `README.md`、`wrangler.jsonc`
  - `apps/web/src/pages/dashboard.tsx`、`apps/web/src/components/dashboard-stat-layout.ts`、`apps/web/src/components/upcoming-renewals.tsx`
  - `apps/web/src/modules/subscriptions/domain/upcoming-reminders.ts`
  - `packages/shared/src/schemas/subscriptions.ts`、`packages/shared/src/schemas/settings.ts`、`packages/shared/src/runtime.ts`
  - `docs/screenshots/renewlet-dashboard-en.png`、`docs/screenshots/renewlet-subscriptions-h5-en.png`
- Recurring Expense Tracker：<https://github.com/DennisBauer/RecurringExpenseTracker/tree/76a0453fa4c2706216e0a72d2249564607cd0005>
  - `README.md`、`shared/src/commonMain/composeResources/values/strings.xml`
  - `shared/src/commonMain/kotlin/de/dbauer/expensetracker/shared/ui/settings/SettingsMainScreen.kt`
  - `shared/src/commonMain/kotlin/de/dbauer/expensetracker/shared/ui/upcomingexpenses/UpcomingPaymentsScreen.kt`
  - `fastlane/metadata/android/en-US/images/phoneScreenshots/01.png`、`03.png`
- Zublo（只讀 README）：<https://github.com/danielalves96/zublo>

### 產品文件

- Firefly III：<https://docs.firefly-iii.org/how-to/firefly-iii/finances/subscriptions/>
- Bobby App Store：<https://apps.apple.com/us/app/bobby-track-subscriptions/id1059152023>
- Bobby 第三方評論：<https://rhymeswithdiploma.com/2020/02/07/tracking-subscriptions/>
- Rocket Money：<https://help.rocketmoney.com/en/articles/3117398-where-can-i-view-my-subscriptions-and-bills>、<https://help.rocketmoney.com/en/articles/2185531-managing-your-bills-and-subscriptions>
- Apple：<https://support.apple.com/guide/iphone/see-your-purchases-and-subscriptions-iph4e3e7324f/ios>、<https://support.apple.com/en-us/118428>、<https://support.apple.com/guide/iphone/use-smart-lists-iphe882772ed/ios>
- Google Play：<https://support.google.com/googleplay/answer/2476088>

### UX 研究與平台指引

- NN/g，Dashboards: Making Charts and Graphs Easier to Understand：<https://www.nngroup.com/articles/dashboards-preattentive/>
- NN/g，Cards: UI-Component Definition：<https://www.nngroup.com/articles/cards-component/>
- NN/g，113 Design Guidelines for Homepage Usability：<https://www.nngroup.com/articles/113-design-guidelines-homepage-usability/>
- Apple HIG：<https://developer.apple.com/design/human-interface-guidelines/layout>、<https://developer.apple.com/design/human-interface-guidelines/designing-for-ios>、<https://developer.apple.com/design/human-interface-guidelines/lists-and-tables>、<https://developer.apple.com/design/human-interface-guidelines/accessibility>
- Material Web，FAB：<https://github.com/material-components/material-web/blob/main/docs/components/fab.md>
