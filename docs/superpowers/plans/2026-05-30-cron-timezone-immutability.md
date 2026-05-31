# 後端 Cron 時區統一與不可變重構 (P2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 修正後端 cron 的兩項缺陷：(1) 時區不一致——`src/index.tsx` scheduled handler 用 `new Date().getUTCHours()`、`src/services/notifier/index.ts` 用 `new Date().getHours()`，兩者皆忽略 `config.TIMEZONE`；(2) 假純函數真 mutation——`processSubscriptionReminder` 註解標示為純函數卻直接改動傳入的 `subscription` 物件。修正後行為必須與原本等價，並以單元測試鎖定。

**Architecture:** 維持既有分層。Fix 1 在 `src/services/config.ts` 新增 `getCurrentHour(config: Config): number`（內部以 `utils/time.ts` 的 `getDateParts(new Date(), config.TIMEZONE).hour` 實作），讓兩個呼叫端統一改用它；`isNotificationAllowedAtHour` 簽名不變。Fix 2 把 `processSubscriptionReminder` 改為以 spread 建立新物件回傳，不再 mutate 輸入參數。

**Tech Stack:** Cloudflare Workers + Hono + Vite + TypeScript（strict、禁用 `any`）；測試以 vitest（已 bootstrap）；套件管理 bun。

---

## File Structure

| 路徑 | 動作 | 說明 |
|------|------|------|
| `src/services/config.ts` | Modify | 新增 `getCurrentHour(config)`，緊鄰 `isNotificationAllowedAtHour`（~line 262） |
| `src/services/config.test.ts` | Create | `getCurrentHour` 單元測試（時區行為） |
| `src/index.tsx` | Modify | scheduled handler（~line 98）`getUTCHours()` → `getCurrentHour(config)`；補 import |
| `src/services/notifier/index.ts` | Modify | `sendNotificationToAllChannels`（~line 35）`getHours()` → `getCurrentHour(config)`；補 import |
| `src/services/subscription_cron.ts` | Modify | `processSubscriptionReminder`（~line 48-120）改為不可變 |
| `src/services/subscription_cron.test.ts` | Create | `processSubscriptionReminder` 分支 + 輸入未被 mutate 測試 |

---

### Task 1 — Fix 1：時區統一（`getCurrentHour`）

新增 `getCurrentHour(config)` 並讓 `src/index.tsx`、`src/services/notifier/index.ts` 兩處改用它，使通知時段判斷尊重 `config.TIMEZONE`。`isNotificationAllowedAtHour` 簽名不變。

**Files:**
- Create: `src/services/config.test.ts`
- Modify: `src/services/config.ts`（新增 export，緊鄰 `isNotificationAllowedAtHour` ~line 262）
- Modify: `src/index.tsx`（~line 17 import、~line 98 呼叫處）
- Modify: `src/services/notifier/index.ts`（~line 4 import、~line 35 呼叫處）

設計說明（測試的決定性）：`getCurrentHour` 內部呼叫 `new Date()`，是真實時間，無法直接斷言固定數值。本任務以「等價邏輯」鎖定行為：在測試中固定一個已知 `Date`，斷言 `getDateParts(fixedDate, tz).hour` 對不同時區回傳不同小時，藉此證明 `getCurrentHour` 所依賴的轉換正確；並額外用 `vi.useFakeTimers()` + `vi.setSystemTime(fixedDate)` 凍結 `new Date()`，直接斷言 `getCurrentHour(config)` 對不同 `config.TIMEZONE` 的回傳值。兩種方式都不依賴執行當下的真實時間，因此具決定性。

- [ ] **Step 1 — 寫失敗測試**
  建立 `src/services/config.test.ts`，內容如下（完整可執行）：

  ```ts
  import type { Config } from '../types'
  import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
  import { getDateParts } from '../utils/time'
  import { getCurrentHour } from './config'

  function makeConfig(timezone: string): Config {
    return {
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'password',
      JWT_SECRET: 'secret',
      TIMEZONE: timezone,
      NOTIFICATION_HOURS: [],
      ENABLED_NOTIFIERS: [],
    }
  }

  describe('getCurrentHour', () => {
    // 2026-05-30T18:30:00Z：UTC 為 18 點，Asia/Taipei (UTC+8) 為隔日 02 點
    const fixedDate = new Date('2026-05-30T18:30:00.000Z')

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(fixedDate)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns the UTC hour when TIMEZONE is UTC', () => {
      expect(getCurrentHour(makeConfig('UTC'))).toBe(18)
    })

    it('returns the Asia/Taipei hour (UTC+8) for the same instant', () => {
      expect(getCurrentHour(makeConfig('Asia/Taipei'))).toBe(2)
    })

    it('differs between UTC and Asia/Taipei for the same instant', () => {
      const utcHour = getCurrentHour(makeConfig('UTC'))
      const taipeiHour = getCurrentHour(makeConfig('Asia/Taipei'))
      expect(utcHour).not.toBe(taipeiHour)
    })

    it('is consistent with getDateParts on the underlying clock', () => {
      const config = makeConfig('America/New_York')
      expect(getCurrentHour(config)).toBe(getDateParts(new Date(), config.TIMEZONE).hour)
    })
  })
  ```

- [ ] **Step 2 — 執行測試，預期 FAIL**
  `bun run test src/services/config.test.ts`
  預期：失敗，錯誤類似 `getCurrentHour is not a function` / 匯入解析失敗（尚未實作）。

- [ ] **Step 3 — 實作 `getCurrentHour`**
  在 `src/services/config.ts` 頂部匯入 `getDateParts`：

  ```ts
  import { getDateParts } from '../utils/time'
  ```

  在 `isNotificationAllowedAtHour`（~line 262）之後新增：

  ```ts
  /**
   * 獲取當前小時（依 config.TIMEZONE 解析）
   * @param config 配置對象
   * @returns 當前小時 (0-23)
   */
  export function getCurrentHour(config: Config): number {
    return getDateParts(new Date(), config.TIMEZONE).hour
  }
  ```

- [ ] **Step 4 — 執行測試，預期 PASS**
  `bun run test src/services/config.test.ts`
  預期：4 個測試全綠。

- [ ] **Step 5 — 接線 `src/index.tsx` scheduled handler**
  將 import（~line 17）改為一併匯入 `getCurrentHour`：

  ```ts
  import { getConfig, getCurrentHour, isNotificationAllowedAtHour } from './services/config'
  ```

  將 ~line 97-98 的：

  ```ts
  // 2. 檢查通知時段（UTC）
  const currentHour = new Date().getUTCHours()
  ```

  改為：

  ```ts
  // 2. 檢查通知時段（依 config.TIMEZONE）
  const currentHour = getCurrentHour(config)
  ```

  同步更新緊接其後的 log 訊息（~line 100），把寫死的 `UTC` 字樣改為中性描述：

  ```ts
  loggerUtil.info(`[Cron] 當前時段 ${currentHour}時 不在允許範圍，跳過`, {
  ```

- [ ] **Step 6 — 接線 `src/services/notifier/index.ts`**
  import（~line 4）改為一併匯入 `getCurrentHour`：

  ```ts
  import { getCurrentHour, isNotificationAllowedAtHour } from '../config'
  ```

  將 ~line 35 的：

  ```ts
  const currentHour = new Date().getHours()
  ```

  改為：

  ```ts
  const currentHour = getCurrentHour(config)
  ```

- [ ] **Step 7 — typecheck**
  `bun run typecheck`
  預期：無錯誤（`getCurrentHour` 已 export 且兩處 import 正確；無 `any`）。

- [ ] **Step 8 — 全測試回歸**
  `bun run test`
  預期：全綠（含新增的 config 測試與既有測試）。

- [ ] **Step 9 — Commit**
  `git add src/services/config.ts src/services/config.test.ts src/index.tsx src/services/notifier/index.ts`
  Commit message：

  ```
  fix(cron): unify notification hour resolution to config.TIMEZONE

  Add getCurrentHour(config) in services/config.ts using
  getDateParts(new Date(), config.TIMEZONE).hour, and replace the
  inconsistent new Date().getUTCHours() (index.tsx scheduled) and
  new Date().getHours() (notifier) call sites. isNotificationAllowedAtHour
  signature unchanged.
  ```

---

### Task 2 — Fix 2：`processSubscriptionReminder` 不可變重構

把 `processSubscriptionReminder` 改為不 mutate 傳入的 `subscription`，以 spread 建立新物件並作為 `updatedSubscription` 回傳。行為必須與原本等價。

**Files:**
- Create: `src/services/subscription_cron.test.ts`
- Modify: `src/services/subscription_cron.ts`（`processSubscriptionReminder` ~line 48-120）

設計說明：原實作在三處 mutate 輸入 `subscription`——自動續期區塊（~line 68-71）、發送成功區塊（~line 104-106），以及 `shouldSendReminder` 透過 `subscription.lastReminderSentAt`/`lastCheckedExpiryDate` 讀取。重構策略：建立一個 working copy（`let current = { ...subscription }`），所有變更都產生新的 `current`（再 spread），`shouldSendReminder` 與後續判斷皆讀 `current`，回傳時帶 `current`。原始參數 `subscription` 全程不被改動。測試以 `notifier` 模組 mock 避免網路，並對輸入做 deep-clone 後比對確認未被 mutate。

- [ ] **Step 1 — 寫失敗測試**
  建立 `src/services/subscription_cron.test.ts`，內容如下（完整可執行）。注意：先 `vi.mock('./notifier', ...)` 再匯入受測模組，使 `sendSubscriptionReminder` 受控、不發網路；用 `mockResolvedValue` 切換成功/失敗。

  ```ts
  import type { Config, Subscription } from '../types'
  import { beforeEach, describe, expect, it, vi } from 'vitest'

  // Mock notifier so processSubscriptionReminder never hits the network.
  vi.mock('./notifier', () => ({
    sendSubscriptionReminder: vi.fn(),
  }))

  // Mock subscription so applyAutoRenewal is deterministic and isolated.
  vi.mock('./subscription', () => ({
    applyAutoRenewal: vi.fn(),
  }))

  const { sendSubscriptionReminder } = await import('./notifier')
  const { applyAutoRenewal } = await import('./subscription')
  const { processSubscriptionReminder } = await import('./subscription_cron')

  const sendMock = vi.mocked(sendSubscriptionReminder)
  const renewalMock = vi.mocked(applyAutoRenewal)

  function makeConfig(): Config {
    return {
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'password',
      JWT_SECRET: 'secret',
      TIMEZONE: 'UTC',
      NOTIFICATION_HOURS: [],
      ENABLED_NOTIFIERS: ['telegram'],
      REMINDER_MODE: 'ONCE',
    }
  }

  function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
    return {
      id: 'sub-1',
      name: 'Netflix',
      expiryDate: '2026-06-01T00:00:00.000Z',
      autoRenew: false,
      isActive: true,
      isReminderSet: true,
      reminderMe: 7,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    }
  }

  const okResult = {
    totalChannels: 1,
    successCount: 1,
    failureCount: 0,
    results: [{ channel: 'telegram', success: true }],
  }
  const failResult = {
    totalChannels: 1,
    successCount: 0,
    failureCount: 1,
    results: [{ channel: 'telegram', success: false, error: 'boom' }],
  }

  // 固定「現在」為到期前 3 天，落在 reminderMe=7 的提醒窗口內。
  const currentTime = new Date('2026-05-29T00:00:00.000Z')

  beforeEach(() => {
    vi.clearAllMocks()
    renewalMock.mockReturnValue({ renewed: false })
  })

  describe('processSubscriptionReminder', () => {
    it('skips inactive / unset subscriptions without sending', async () => {
      const sub = makeSubscription({ isActive: false })
      const result = await processSubscriptionReminder(sub, currentTime, makeConfig())
      expect(result.action).toBe('skipped')
      expect(result.success).toBe(true)
      expect(sendMock).not.toHaveBeenCalled()
    })

    it('reminds when in window and send succeeds', async () => {
      sendMock.mockResolvedValue(okResult)
      const sub = makeSubscription()
      const result = await processSubscriptionReminder(sub, currentTime, makeConfig())
      expect(result.action).toBe('reminded')
      expect(result.success).toBe(true)
      expect(result.updatedSubscription?.lastReminderSentAt).toBe(currentTime.toISOString())
      expect(result.updatedSubscription?.lastCheckedExpiryDate).toBe(sub.expiryDate)
      expect(sendMock).toHaveBeenCalledTimes(1)
    })

    it('reports reminded:false when send fails', async () => {
      sendMock.mockResolvedValue(failResult)
      const sub = makeSubscription()
      const result = await processSubscriptionReminder(sub, currentTime, makeConfig())
      expect(result.action).toBe('reminded')
      expect(result.success).toBe(false)
    })

    it('renews when expired and autoRenew, returning updatedSubscription', async () => {
      const newExpiry = '2026-06-29T00:00:00.000Z'
      renewalMock.mockReturnValue({ renewed: true, newExpiryDate: newExpiry })
      // 已過期：expiryDate 在 currentTime 之前
      const sub = makeSubscription({
        autoRenew: true,
        expiryDate: '2026-05-01T00:00:00.000Z',
      })
      const result = await processSubscriptionReminder(sub, currentTime, makeConfig())
      // 續期後新到期日距今約一個月，超出 reminderMe 窗口 → renewed 但不發送
      expect(result.action).toBe('renewed')
      expect(result.success).toBe(true)
      expect(result.updatedSubscription?.expiryDate).toBe(newExpiry)
      expect(result.updatedSubscription?.lastCheckedExpiryDate).toBe(newExpiry)
      expect(result.updatedSubscription?.lastReminderSentAt).toBeUndefined()
      expect(sendMock).not.toHaveBeenCalled()
    })

    it('does NOT mutate the input subscription (reminded path)', async () => {
      sendMock.mockResolvedValue(okResult)
      const sub = makeSubscription()
      const snapshot = structuredClone(sub)
      await processSubscriptionReminder(sub, currentTime, makeConfig())
      expect(sub).toEqual(snapshot)
    })

    it('does NOT mutate the input subscription (renewed path)', async () => {
      renewalMock.mockReturnValue({
        renewed: true,
        newExpiryDate: '2026-06-29T00:00:00.000Z',
      })
      const sub = makeSubscription({
        autoRenew: true,
        expiryDate: '2026-05-01T00:00:00.000Z',
      })
      const snapshot = structuredClone(sub)
      await processSubscriptionReminder(sub, currentTime, makeConfig())
      expect(sub).toEqual(snapshot)
    })
  })
  ```

- [ ] **Step 2 — 執行測試，預期 FAIL**
  `bun run test src/services/subscription_cron.test.ts`
  預期：`reminded`/`renewed` 分支可能通過，但兩個「does NOT mutate」測試 FAIL（目前實作會改動 `sub.lastReminderSentAt` / `sub.expiryDate` 等欄位，`structuredClone` 快照比對不相等）。

- [ ] **Step 3 — 不可變重構**
  將 `src/services/subscription_cron.ts` 的 `processSubscriptionReminder`（~line 48-120）整段替換為下列實作。重點：以 `current` 作為唯一可變的 working copy，每次更新都 spread 出新物件，輸入 `subscription` 全程唯讀；`shouldSendReminder` 改傳 `current`；回傳一律帶 `current`。

  ```ts
  export async function processSubscriptionReminder(
    subscription: Subscription,
    currentTime: Date,
    config: Config,
  ): Promise<{ action: 'reminded' | 'renewed' | 'skipped', success: boolean, updatedSubscription?: Subscription }> {
    try {
      // 1. 前置檢查
      if (!subscription.isActive || !subscription.isReminderSet || !subscription.reminderMe || !subscription.expiryDate) {
        return { action: 'skipped', success: true }
      }

      // 以 working copy 累積變更，絕不 mutate 輸入參數
      let current: Subscription = { ...subscription }

      // 2. 自動續期（如果過期且 autoRenew=true）
      let expiryDate = new Date(current.expiryDate)
      let needsUpdate = false

      if (current.autoRenew && expiryDate < currentTime) {
        const renewal = applyAutoRenewal(current, currentTime)

        if (renewal.renewed && renewal.newExpiryDate) {
          expiryDate = new Date(renewal.newExpiryDate)
          current = {
            ...current,
            expiryDate: renewal.newExpiryDate,
            updatedAt: currentTime.toISOString(),
            lastReminderSentAt: undefined,
            lastCheckedExpiryDate: renewal.newExpiryDate,
          }
          needsUpdate = true
        }
      }

      // 3. 計算提醒窗口
      const daysDiff = getDaysDifference(currentTime, expiryDate, 'UTC')
      const isInReminderWindow = daysDiff >= 0 && daysDiff <= current.reminderMe

      if (!isInReminderWindow) {
        if (needsUpdate) {
          return { action: 'renewed', success: true, updatedSubscription: current }
        }
        return { action: 'skipped', success: true }
      }

      // 4. 判斷是否需要發送提醒
      if (!shouldSendReminder(current, currentTime, config)) {
        if (needsUpdate) {
          return { action: 'skipped', success: true, updatedSubscription: current }
        }
        return { action: 'skipped', success: true }
      }

      // 5. 發送提醒
      const result = await sendSubscriptionReminder(
        current.name,
        current.expiryDate,
        daysDiff,
        config,
      )

      if (result.successCount > 0) {
        const reminded: Subscription = {
          ...current,
          lastReminderSentAt: currentTime.toISOString(),
          lastCheckedExpiryDate: current.expiryDate,
          updatedAt: currentTime.toISOString(),
        }
        return { action: 'reminded', success: true, updatedSubscription: reminded }
      }
      else {
        if (needsUpdate) {
          return { action: 'reminded', success: false, updatedSubscription: current }
        }
        return { action: 'reminded', success: false }
      }
    }
    catch (error) {
      logger.error(`處理訂閱失敗: ${subscription.name}`, error, { prefix: 'Cron' })
      return { action: 'skipped', success: false }
    }
  }
  ```

  同時更新函數上方 docstring（~line 44-47），讓「純函數」描述名實相符：

  ```ts
  /**
   * 處理單個訂閱的提醒邏輯
   * 純函數：不 mutate 傳入的 subscription，也不寫入 KV，
   * 而是回傳更新後的訂閱對象（updatedSubscription）
   */
  ```

- [ ] **Step 4 — 執行測試，預期 PASS**
  `bun run test src/services/subscription_cron.test.ts`
  預期：全部測試綠，含兩個「does NOT mutate」測試。

- [ ] **Step 5 — typecheck**
  `bun run typecheck`
  預期：無錯誤（無 `any`；`current` 型別為 `Subscription`；spread 後型別不變）。

- [ ] **Step 6 — 全測試回歸**
  `bun run test`
  預期：全綠。

- [ ] **Step 7 — Commit**
  `git add src/services/subscription_cron.ts src/services/subscription_cron.test.ts`
  Commit message：

  ```
  refactor(cron): make processSubscriptionReminder immutable

  Stop mutating the input subscription; build new objects via spread on a
  working copy and return them as updatedSubscription. Behavior is
  equivalent (skipped / reminded / renewed branches verified by unit
  tests, including input-not-mutated assertions).
  ```

---

## Self-Review

**Spec coverage（§4 後端 cron 修正）**
- §4.1 時區不一致：Task 1 新增 `getCurrentHour(config)`，以 `getDateParts(new Date(), config.TIMEZONE).hour` 實作；`src/index.tsx`（`getUTCHours`）與 `src/services/notifier/index.ts`（`getHours`）兩處皆改用它；`isNotificationAllowedAtHour` 簽名不變。✅
- §4.2 假純函數真 mutation：Task 2 以 working copy + spread 重構 `processSubscriptionReminder`，不再 mutate 輸入，行為等價；以單元測試（含 `structuredClone` 快照比對）驗證輸入未被改動。✅
- TDD 流程：每個 fix 都先寫失敗測試（含完整測試碼）→ `bun run test <file>` 預期 FAIL → 實作 → 預期 PASS → typecheck → 全測試回歸 → conventional commit（無 Co-Authored-By）。✅

**Placeholder scan**
- 無 `TODO` / `FIXME` / `<...>` 佔位符。所有測試碼、實作碼、import 路徑、commit message 均為完整可執行內容。檔案路徑皆為實際存在的相對路徑（含對應行號區間）。

**Type consistency**
- 全程禁用 `any`（符合專案 strict + 「一律不使用 any」）。`getCurrentHour(config: Config): number` 回傳 `DateParts.hour`（`number`）。`processSubscriptionReminder` 的 working copy `current` 維持 `Subscription` 型別，spread 不改變型別；回傳型別與原簽名一致（`updatedSubscription?: Subscription`）。
- 測試 helper `makeConfig` 只填 `Config` 必填欄位（`ADMIN_USERNAME`/`ADMIN_PASSWORD`/`JWT_SECRET`/`TIMEZONE`/`NOTIFICATION_HOURS`/`ENABLED_NOTIFIERS`），其餘為 optional，符合 `src/types/index.ts` 定義。`makeSubscription` 同理涵蓋 `Subscription` 必填欄位（`id`/`name`/`expiryDate`/`autoRenew`/`isActive`/`createdAt`/`updatedAt`）。
- `vi.mock('./notifier')` 與 `vi.mock('./subscription')` 的回傳 shape 對齊 `NotificationResult` 與 `applyAutoRenewal` 的回傳型別，避免 mock 與真實簽名漂移。
