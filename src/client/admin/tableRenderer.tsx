import type { Subscription } from '../../types/index'
/** @jsxImportSource hono/jsx/dom */
import { render } from 'hono/jsx/dom'
import { createIcons, TriangleAlert } from 'lucide'
import { SubscriptionTable } from '../../components/admin/SubscriptionTable'
import { ErrorState, LoadingState } from '../../components/admin/SubscriptionTableStates'

export function renderSubscriptionTable(
  subscriptions: Subscription[],
  searchKeyword: string,
  categoryFilter: string,
  handlers: {
    onEdit: (id: string) => Promise<void>
    onDelete: (id: string) => Promise<void>
    onToggleStatus: (id: string, targetStatus: boolean) => Promise<void>
    onTestNotify: (id: string) => Promise<void>
  },
) {
  const tbody = document.getElementById('subscriptionsBody')
  if (!tbody)
    return

  tbody.innerHTML = ''
  render(
    <SubscriptionTable
      subscriptions={subscriptions}
      searchKeyword={searchKeyword}
      categoryFilter={categoryFilter}
      handlers={handlers}
    />,
    tbody,
  )

  // 重新掃描並渲染新添加的 lucide icons
  createIcons({
    icons: { TriangleAlert },
    attrs: { 'stroke-width': 2, 'class': 'lucide-icon' },
    nameAttr: 'data-lucide',
  })
}

export function renderLoadingState() {
  const tbody = document.getElementById('subscriptionsBody')
  if (!tbody)
    return
  tbody.innerHTML = ''
  render(<LoadingState />, tbody)
}

export function renderErrorState(message: string) {
  const tbody = document.getElementById('subscriptionsBody')
  if (!tbody)
    return
  tbody.innerHTML = ''
  render(<ErrorState message={message} />, tbody)
}
