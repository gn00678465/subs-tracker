import type { Subscription } from '../../types/index'
/** @jsxImportSource hono/jsx/dom */
import { SubscriptionTable } from '../../components/admin/SubscriptionTable'
import { ErrorState, LoadingState } from '../../components/admin/SubscriptionTableStates'
import { el, mount } from '../lib/dom'
import { renderIcons } from '../lib/icons'

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
  const tbody = el('subscriptionsBody')
  if (!tbody)
    return

  mount(
    tbody,
    <SubscriptionTable
      subscriptions={subscriptions}
      searchKeyword={searchKeyword}
      categoryFilter={categoryFilter}
      handlers={handlers}
    />,
  )

  renderIcons(tbody)
}

export function renderLoadingState() {
  const tbody = el('subscriptionsBody')
  if (!tbody)
    return
  mount(tbody, <LoadingState />)
}

export function renderErrorState(message: string) {
  const tbody = el('subscriptionsBody')
  if (!tbody)
    return
  mount(tbody, <ErrorState message={message} />)
}
