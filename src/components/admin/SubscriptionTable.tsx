import type { Subscription } from '../../types/index'
/** @jsxImportSource hono/jsx/dom */
import { useMemo } from 'hono/jsx/dom'
import { SubscriptionTableRow } from './SubscriptionTableRow'
import { EmptyState } from './SubscriptionTableStates'

interface SubscriptionTableProps {
  subscriptions: Subscription[]
  searchKeyword: string
  categoryFilter: string
  handlers: {
    onEdit: (id: string) => Promise<void>
    onDelete: (id: string) => Promise<void>
    onToggleStatus: (id: string, targetStatus: boolean) => Promise<void>
    onTestNotify: (id: string) => Promise<void>
  }
}

export function SubscriptionTable({
  subscriptions,
  searchKeyword,
  categoryFilter,
  handlers,
}: SubscriptionTableProps) {
  // 使用 useMemo 優化過濾和排序（避免每次渲染重新計算）
  const filteredSubscriptions = useMemo(() => {
    let filtered = subscriptions.slice()

    // 分類過濾（保留原有邏輯 index.ts:153-162）
    if (categoryFilter) {
      filtered = filtered.filter((sub) => {
        if (!sub.category)
          return false
        const tokens = sub.category.split(/[/,\s]+/).map(t => t.trim().toLowerCase())
        return tokens.includes(categoryFilter)
      })
    }

    // 關鍵字搜尋（保留原有邏輯 index.ts:164-172）
    if (searchKeyword) {
      filtered = filtered.filter((sub) => {
        const haystack = [sub.name, sub.customType, sub.notes, sub.category]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(searchKeyword)
      })
    }

    // 依到期日期排序（保留原有邏輯 index.ts:179-181）
    return filtered.sort((a, b) => {
      return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
    })
  }, [subscriptions, searchKeyword, categoryFilter])

  // 空狀態
  if (filteredSubscriptions.length === 0) {
    return <EmptyState />
  }

  // 渲染行
  return (
    <>
      {filteredSubscriptions.map(sub => (
        <SubscriptionTableRow
          key={sub.id}
          subscription={sub}
          onEdit={handlers.onEdit}
          onDelete={handlers.onDelete}
          onToggleStatus={handlers.onToggleStatus}
          onTestNotify={handlers.onTestNotify}
        />
      ))}
    </>
  )
}
