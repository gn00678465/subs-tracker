import type { Bindings, Config, Subscription } from '../types'
import * as logger from '../utils/logger'
import { getDaysDifference, getMidnightTimestamp } from '../utils/time'
import { sendSubscriptionReminder } from './notifier'
import { applyAutoRenewal, getAllSubscriptions } from './subscription'

/**
 * Cron 任務相關函數
 */

/**
 * 更新訂閱到 KV
 */
async function updateSubscriptionInKV(
  subscription: Subscription,
  env: Bindings,
): Promise<void> {
  const subscriptions = await getAllSubscriptions(env)
  const index = subscriptions.findIndex(s => s.id === subscription.id)

  if (index === -1) {
    throw new Error(`訂閱不存在: ${subscription.id}`)
  }

  subscriptions[index] = subscription
  await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions))
}

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
 */
export async function processSubscriptionReminder(
  subscription: Subscription,
  currentTime: Date,
  config: Config,
  env: Bindings,
): Promise<{ action: 'reminded' | 'renewed' | 'skipped', success: boolean }> {
  try {
    // 1. 前置檢查
    if (!subscription.isActive || !subscription.isReminderSet || !subscription.reminderMe || !subscription.expiryDate) {
      return { action: 'skipped', success: true }
    }

    // 2. 自動續期（如果過期且 autoRenew=true）
    let expiryDate = new Date(subscription.expiryDate)
    let needsUpdate = false

    if (subscription.autoRenew && expiryDate < currentTime) {
      const renewal = applyAutoRenewal(subscription, currentTime)

      if (renewal.renewed && renewal.newExpiryDate) {
        expiryDate = new Date(renewal.newExpiryDate)
        subscription.expiryDate = renewal.newExpiryDate
        subscription.updatedAt = currentTime.toISOString()
        subscription.lastReminderSentAt = undefined
        subscription.lastCheckedExpiryDate = renewal.newExpiryDate
        needsUpdate = true
      }
    }

    // 3. 計算提醒窗口
    const daysDiff = getDaysDifference(currentTime, expiryDate, 'UTC')
    const isInReminderWindow = daysDiff >= 0 && daysDiff <= subscription.reminderMe

    if (!isInReminderWindow) {
      if (needsUpdate) {
        await updateSubscriptionInKV(subscription, env)
        return { action: 'renewed', success: true }
      }
      return { action: 'skipped', success: true }
    }

    // 4. 判斷是否需要發送提醒
    if (!shouldSendReminder(subscription, currentTime, config)) {
      if (needsUpdate) {
        await updateSubscriptionInKV(subscription, env)
      }
      return { action: 'skipped', success: true }
    }

    // 5. 發送提醒
    const result = await sendSubscriptionReminder(
      subscription.name,
      subscription.expiryDate,
      daysDiff,
      config,
    )

    if (result.successCount > 0) {
      subscription.lastReminderSentAt = currentTime.toISOString()
      subscription.lastCheckedExpiryDate = subscription.expiryDate
      subscription.updatedAt = currentTime.toISOString()
      await updateSubscriptionInKV(subscription, env)
      return { action: 'reminded', success: true }
    }
    else {
      if (needsUpdate) {
        await updateSubscriptionInKV(subscription, env)
      }
      return { action: 'reminded', success: false }
    }
  }
  catch (error) {
    logger.error(`處理訂閱失敗: ${subscription.name}`, error, { prefix: 'Cron' })
    return { action: 'skipped', success: false }
  }
}
