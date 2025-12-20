/** @jsxImportSource hono/jsx/dom */
import type { Subscription } from '../../types/index'
import { calculateRemainingTime, formatDate, formatRemainingTime, getSubscriptionStatus } from './utils'

interface SubscriptionTableRowProps {
  subscription: Subscription
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onToggleStatus: (id: string, targetStatus: boolean) => void
  onTestNotify: (id: string) => void
}

export function SubscriptionTableRow({
  subscription,
  onEdit,
  onDelete,
  onToggleStatus,
  onTestNotify,
}: SubscriptionTableRowProps) {
  const currentTime = new Date()
  const expiryDate = new Date(subscription.expiryDate)
  const { diffMs, diffDays, diffHours } = calculateRemainingTime(expiryDate, currentTime)
  const status = getSubscriptionStatus(subscription, diffDays, diffHours)
  const daysLeftText = formatRemainingTime(diffMs, diffDays, diffHours)

  // Status badge rendering
  const statusBadges = {
    inactive: <div class="badge badge-neutral badge-soft gap-2">已停用</div>,
    expired: <div class="badge badge-error badge-soft gap-2">已過期</div>,
    soon: <div class="badge badge-warning badge-soft gap-2">即將到期</div>,
    normal: <div class="badge badge-success badge-soft gap-2">正常</div>,
  }

  // Category badges
  const categoryBadges = subscription.category
    ?.split(/[/,\s]+/)
    .filter(t => t.trim())
    .map(cat => (
      <div class="badge badge-outline badge-sm" key={cat}>{cat.trim()}</div>
    ))

  // Period and reminder text
  const unitText = subscription.periodUnit === 'day' ? '天' : (subscription.periodUnit === 'month' ? '月' : '年')
  const reminderValue = subscription.reminderValue || 7
  const reminderUnit = subscription.reminderUnit || 'day'
  const reminderUnitText = reminderUnit === 'hour' ? '小時' : '天'

  return (
    <div
      role="row"
      class={`grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1.2fr_1fr_0.5fr_1fr] gap-2 md:gap-4 px-4 py-3 border-b border-base-content/5 hover:bg-base-300 transition-colors ${subscription.isActive === false ? 'opacity-60' : ''}`}
    >
      <div role="cell" class="flex flex-col">
        <span class="md:hidden text-xs text-base-content/50 mb-1">名稱</span>
        <div class="font-medium">{subscription.name}</div>
        {subscription.notes && (
          <div class="text-sm text-base-content/70 mt-1">
            {subscription.notes.length > 50
              ? `${subscription.notes.substring(0, 50)}...`
              : subscription.notes}
          </div>
        )}
      </div>

      <div role="cell" class="flex flex-col gap-1">
        <span class="md:hidden text-xs text-base-content/50 mb-1">類型</span>
        <div>{subscription.customType || '其他'}</div>
        {subscription.periodValue && (
          <div class="text-sm text-base-content/70 mt-1">
            周期:
            {' '}
            {subscription.periodValue}
            {' '}
            {unitText}
          </div>
        )}
        {categoryBadges && categoryBadges.length > 0 && (
          <div class="flex flex-wrap gap-1 mt-2">{categoryBadges}</div>
        )}
      </div>

      <div role="cell" class="flex flex-col">
        <span class="md:hidden text-xs text-base-content/50 mb-1">到期時間</span>
        <div>{formatDate(subscription.expiryDate)}</div>
        <div class="text-sm text-base-content/70 mt-1">{daysLeftText}</div>
        {subscription.startDate && (
          <div class="text-xs text-base-content/50 mt-1">
            開始:
            {' '}
            {formatDate(subscription.startDate)}
          </div>
        )}
      </div>

      <div role="cell" class="flex flex-col">
        <span class="md:hidden text-xs text-base-content/50 mb-1">提醒設置</span>
        <div>
          提前
          {' '}
          {reminderValue}
          {' '}
          {reminderUnitText}
        </div>
        {reminderValue === 0 && (
          <div class="text-sm text-base-content/70 mt-1">僅到期時提醒</div>
        )}
      </div>

      <div role="cell" class="flex flex-col">
        <span class="md:hidden text-xs text-base-content/50 mb-1">狀態</span>
        {statusBadges[status]}
      </div>

      <div role="cell" class="flex flex-col md:flex-row gap-2">
        <span class="md:hidden text-xs text-base-content/50 mb-1">操作</span>
        <div class="flex flex-wrap gap-1">
          <button
            class="btn btn-primary btn-xs"
            onClick={() => onEdit(subscription.id)}
            data-testid="edit-btn"
          >
            編輯
          </button>
          <button
            class="btn btn-info btn-xs"
            onClick={() => onTestNotify(subscription.id)}
            data-testid="test-notify-btn"
          >
            測試
          </button>
          <button
            class="btn btn-error btn-xs"
            onClick={() => onDelete(subscription.id)}
            data-testid="delete-btn"
          >
            刪除
          </button>
          {subscription.isActive
            ? (
                <button
                  class="btn btn-warning btn-xs"
                  onClick={() => onToggleStatus(subscription.id, false)}
                  data-testid="toggle-status-btn"
                >
                  停用
                </button>
              )
            : (
                <button
                  class="btn btn-success btn-xs"
                  onClick={() => onToggleStatus(subscription.id, true)}
                  data-testid="toggle-status-btn"
                >
                  啟用
                </button>
              )}
        </div>
      </div>
    </div>
  )
}
