import type { Config, Subscription } from '../types'
import * as logger from '../utils/logger'
import { getDaysDifference, getMidnightTimestamp } from '../utils/time'
import { sendSubscriptionReminder } from './notifier'
import { applyAutoRenewal } from './subscription'

/**
 * Cron 任務相關函數
 */

/**
 * 判斷是否應該發送提醒（考慮通知頻率模式）
 */
function shouldSendReminder(
  subscription: Subscription,
  currentTime: Date,
  config: Config,
): boolean {
  const mode = config.REMINDER_MODE || 'ONCE'

  // 檢查到期日期是否變更（手動續期）
  if (subscription.lastCheckedExpiryDate
    && subscription.lastCheckedExpiryDate !== subscription.expiryDate) {
    return true
  }

  // 從未發送過
  if (!subscription.lastReminderSentAt) {
    return true
  }

  if (mode === 'ONCE') {
    return false
  }
  else {
    // DAILY 模式：檢查今天是否已發送
    const lastSentDate = new Date(subscription.lastReminderSentAt)
    const lastSentMidnight = getMidnightTimestamp(lastSentDate, 'UTC')
    const currentMidnight = getMidnightTimestamp(currentTime, 'UTC')
    return lastSentMidnight !== currentMidnight
  }
}

/**
 * 處理單個訂閱的提醒邏輯
 * 純函數：不 mutate 傳入的 subscription，也不寫入 KV，
 * 而是回傳更新後的訂閱對象（updatedSubscription）
 */
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
    const isInReminderWindow = daysDiff >= 0 && daysDiff <= subscription.reminderMe

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
