import type { Subscription } from '../../types/index'
/** @jsxImportSource hono/jsx/dom */
import { render } from 'hono/jsx/dom'
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
