# Cron 分析與風險

**日期：** 2025-12-24
**背景：** 分析 `sub` 專案中定時提醒（cron / scheduled）流程的實作與風險評估。

## 檢視檔案
- `src/index.tsx`（scheduled handler）
- `src/services/subscription_cron.ts`（`processSubscriptionReminder`、`updateSubscriptionInKV`）
- `src/services/subscription.ts`（`applyAutoRenewal`、`getAllSubscriptions`）
- `src/services/notifier/index.ts`（`sendSubscriptionReminder`、`sendNotificationToAllChannels`）
- `src/services/notifier/channels/*`（例如：`telegram`）
- `src/utils/time.ts`（時間工具）

## 流程摘要
- Scheduled handler 會讀取設定並檢查允許的 UTC 時段，抓取所有訂閱後，使用 `Promise.allSettled` 並行執行每個訂閱的 `processSubscriptionReminder`。
- `processSubscriptionReminder` 包含前置檢查、必要時套用自動續期（`applyAutoRenewal`）、計算提醒區間（`daysDiff`）、判斷是否需發提醒（`shouldSendReminder`，會參考 `REMINDER_MODE` 與 `lastCheckedExpiryDate`）、呼叫 `sendSubscriptionReminder` 發送通知，並視情況透過 `updateSubscriptionInKV` 更新 KV。
- 發送通知層（`sendSubscriptionReminder` → `sendNotificationToAllChannels`）也會再次檢查允許時段，並對已啟用的頻道並行發送。

## 主要發現與風險
1. **KV 寫入競態（高風險）**：`updateSubscriptionInKV` 採取讀取整個陣列、修改單筆、再整體寫回的策略；因為訂閱處理在並行執行，會產生並發寫入導致的資料遺失（lost updates）。
2. **無上限併發與速率限制風險（中風險）**：大量訂閱與多頻道並行發送可能觸及外部 API 的速率限制或消耗過多資源。
3. **時區/時間檢查一致性（中風險）**：程式中有 `getUTCHours()` 與 `getHours()` 的混用，建議統一明確使用 UTC（或透過集中時間工具）以避免誤判。
4. **重試/失敗策略缺乏（中風險）**：目前沒有針對通知失敗的重試或退避策略；`REMINDER_MODE='ONCE'` 下現行行為（失敗不更新最後發送時間）算合理，但仍建議加入重試機制以處理短暫性錯誤。
5. **可觀測性與測試覆蓋不足（低中風險）**：缺少針對邊緣情境（自動續期、提醒窗口邊界、所有頻道失敗）的單元或整合測試，以及更細緻的 per-subscription 日誌。

## 建議修正 / 下一步
- **立即採取**：避免並發 KV 寫入，可改為在 scheduled 執行中收集所有訂閱的變更，最後做一次合併寫回；或暫時改為序列化/分批處理以降低風險。
- **推薦改進**：為訂閱處理與頻道發送新增併發限制（例如 p-limit 或分批），加入通知發送的重試與退避策略，並補齊 `processSubscriptionReminder` 與 scheduled 行為的測試。
- **額外**：加強日誌以包含頻道層級結果，並在訂閱紀錄中新增失敗計數或最後錯誤 metadata，方便排查。

## 實作選項
- 短期：將 scheduled 處理改為序列或分批以避免寫入衝突（較快落地）。
- 長期（推薦）：讓 `processSubscriptionReminder` 回傳差異（diff），由 scheduled 在所有任務完成後做一次確定性合併與寫回；同時加入測試與併發控制。