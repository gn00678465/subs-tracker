import type { Config, Subscription } from '../types'
import type { CalendarDate } from '../utils/calendarDate'
import { daysBetween, todayIn } from '../utils/calendarDate'
import * as logger from '../utils/logger'
import { sendSubscriptionReminder } from './notifier'
import { applyAutoRenewal } from './subscription'

/**
 * 判斷是否應該發送提醒（考慮通知頻率模式）
 */
function shouldSendReminder(subscription: Subscription, today: CalendarDate, config: Config): boolean {
  // 到期日變更（手動續期）後重新提醒
  if (subscription.lastCheckedExpiryDate && subscription.lastCheckedExpiryDate !== subscription.expiryDate) {
    return true
  }
  if (!subscription.lastReminderSentAt) {
    return true
  }
  if (config.REMINDER_MODE === 'DAILY') {
    return todayIn(config.TIMEZONE, new Date(subscription.lastReminderSentAt)) !== today
  }
  return false
}

/**
 * 處理單個訂閱的提醒邏輯
 * 不寫入 KV，回傳需要保存的訂閱
 */
export async function processSubscriptionReminder(
  original: Subscription,
  now: Date,
  config: Config,
): Promise<{ action: 'reminded' | 'renewed' | 'skipped'; success: boolean; updatedSubscription?: Subscription }> {
  try {
    const { reminderMe } = original
    if (!original.isActive || !original.isReminderSet || !reminderMe || !original.expiryDate) {
      return { action: 'skipped', success: true }
    }

    const today = todayIn(config.TIMEZONE, now)
    const renewal = applyAutoRenewal(original, today)
    const subscription: Subscription = renewal.newExpiryDate
      ? {
          ...original,
          expiryDate: renewal.newExpiryDate,
          lastCheckedExpiryDate: renewal.newExpiryDate,
          lastReminderSentAt: undefined,
          updatedAt: now.toISOString(),
        }
      : original
    const renewed = subscription !== original

    const daysLeft = daysBetween(today, subscription.expiryDate)
    const isInReminderWindow = daysLeft >= 0 && daysLeft <= reminderMe

    if (!isInReminderWindow || !shouldSendReminder(subscription, today, config)) {
      return renewed
        ? { action: 'renewed', success: true, updatedSubscription: subscription }
        : { action: 'skipped', success: true }
    }

    const result = await sendSubscriptionReminder(subscription.name, subscription.expiryDate, daysLeft, config)

    if (result.successCount > 0) {
      return {
        action: 'reminded',
        success: true,
        updatedSubscription: {
          ...subscription,
          lastReminderSentAt: now.toISOString(),
          lastCheckedExpiryDate: subscription.expiryDate,
          updatedAt: now.toISOString(),
        },
      }
    }
    return { action: 'reminded', success: false, updatedSubscription: renewed ? subscription : undefined }
  } catch (error) {
    logger.error(`處理訂閱失敗: ${original.name}`, error, { prefix: 'Cron' })
    return { action: 'skipped', success: false }
  }
}
