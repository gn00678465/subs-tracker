import type { Subscription } from '../../types/index'

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
 * 計算到期時間差異
 */
export function calculateRemainingTime(expiryDate: Date, currentTime: Date) {
  const diffMs = expiryDate.getTime() - currentTime.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))

  return { diffMs, diffDays, diffHours }
}

/**
 * 格式化剩餘時間文字
 */
export function formatRemainingTime(
  diffMs: number,
  diffDays: number,
  diffHours: number,
): string {
  if (diffMs < 0) {
    const absDays = Math.abs(diffDays)
    return absDays >= 1
      ? `已過期 ${absDays} 天`
      : `已過期 ${Math.abs(diffHours)} 小時`
  }

  if (diffDays >= 1) {
    return `還剩 ${diffDays} 天`
  }

  return diffHours > 0 ? `約 ${diffHours} 小時後到期` : '即將到期'
}

/**
 * 判斷訂閱狀態
 */
export function getSubscriptionStatus(
  subscription: Subscription,
  diffDays: number,
  diffHours: number,
): 'inactive' | 'expired' | 'soon' | 'normal' {
  if (!subscription.isActive)
    return 'inactive'
  if (diffDays < 0)
    return 'expired'

  const reminderDays = subscription.reminderMe ?? 7

  const isSoon = diffDays >= 0 && diffDays <= reminderDays

  return isSoon ? 'soon' : 'normal'
}
