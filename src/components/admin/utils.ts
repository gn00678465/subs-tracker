import type { Subscription } from '../../types/index'
import { differenceInDays } from 'date-fns/differenceInDays'
import { differenceInHours } from 'date-fns/differenceInHours'
import { differenceInWeeks } from 'date-fns/differenceInWeeks'

/**
 * 格式化日期為 zh-TW 格式
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * 格式化剩餘時間文字（顯示週數/天數/小時數）
 */
export function formatRemainingTime(
  expiryDate: Date,
  currentTime: Date = new Date(),
): string {
  const diffWeeks = differenceInWeeks(expiryDate, currentTime)

  // >= 1 週：顯示週數
  if (Math.abs(diffWeeks) >= 1) {
    return diffWeeks < 0
      ? `已過期 ${Math.abs(diffWeeks)} 週`
      : `還剩 ${diffWeeks} 週`
  }

  // < 1 週：檢查天數
  const diffDays = differenceInDays(expiryDate, currentTime)

  if (Math.abs(diffDays) >= 1) {
    return diffDays < 0
      ? `已過期 ${Math.abs(diffDays)} 天`
      : `還剩 ${diffDays} 天`
  }

  // < 1 天：檢查小時數（使用 ceiling）
  const diffHours = differenceInHours(expiryDate, currentTime)

  if (diffHours < 0) {
    return `已過期 ${Math.ceil(Math.abs(diffHours))} 小時`
  }

  return diffHours > 0 ? `約 ${Math.ceil(diffHours)} 小時後到期` : '即將到期'
}

/**
 * 判斷訂閱狀態
 */
export function getSubscriptionStatus(
  subscription: Subscription,
  expiryDate: Date,
  currentTime: Date = new Date(),
): 'inactive' | 'expired' | 'soon' | 'normal' {
  if (!subscription.isActive)
    return 'inactive'

  const diffDays = differenceInDays(expiryDate, currentTime)

  if (diffDays < 0)
    return 'expired'

  const reminderDays = subscription.reminderMe ?? 7
  const isSoon = diffDays >= 0 && diffDays <= reminderDays

  return isSoon ? 'soon' : 'normal'
}
