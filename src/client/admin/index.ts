import type { Subscription } from '../../types/index'
import { toFormFormat } from '../../utils/formAdaptor'
import { toast } from '../../utils/toast'
import { renderErrorState, renderLoadingState, renderSubscriptionTable } from './tableRenderer'

// ===== 表單輔助函數 =====

/**
 * 設置表單欄位的值（自動處理不同類型的元素）
 */
function setFormValue(
  form: HTMLFormElement,
  name: string,
  value: string | boolean | number | undefined,
): void {
  const element = form.elements.namedItem(name)
  if (!element) {
    console.warn(`Form element "${name}" not found`)
    return
  }

  if (element instanceof HTMLInputElement && element.type === 'checkbox') {
    element.checked = Boolean(value)
  }
  else if (
    element instanceof HTMLInputElement
    || element instanceof HTMLSelectElement
    || element instanceof HTMLTextAreaElement
  ) {
    element.value = value !== undefined && value !== null ? String(value) : ''
  }
}

// ===== 事件處理器物件 =====
const tableHandlers = {
  onEdit: handleEdit,
  onDelete: handleDelete,
  onToggleStatus: handleToggleStatus,
  onTestNotify: handleTestNotify,
}

/**
 * 批量設置表單欄位的值
 */
function setFormValues(
  form: HTMLFormElement,
  data: Record<string, string | boolean | number | undefined>,
): void {
  Object.entries(data).forEach(([name, value]) => {
    setFormValue(form, name, value)
  })
}

// ===== 全局變量 =====
let searchDebounceTimer: NodeJS.Timeout | null = null
const subscriptionsCache: Subscription[] = []

// ===== 快取管理工具 =====
function getCacheItem(id: string): Subscription | undefined {
  return subscriptionsCache.find(sub => sub.id === id)
}

function updateCacheItem(id: string, updates: Partial<Subscription>): void {
  const index = subscriptionsCache.findIndex(sub => sub.id === id)
  if (index !== -1) {
    subscriptionsCache[index] = { ...subscriptionsCache[index], ...updates }
    renderSubscriptionTable(subscriptionsCache, getSearchKeyword(), getCategoryFilter(), tableHandlers)
  }
}

function removeCacheItem(id: string): void {
  const index = subscriptionsCache.findIndex(sub => sub.id === id)
  if (index !== -1) {
    subscriptionsCache.splice(index, 1)
    renderSubscriptionTable(subscriptionsCache, getSearchKeyword(), getCategoryFilter(), tableHandlers)
  }
}

async function loadSubscriptions(showLoading: boolean = true) {
  showLoading = showLoading !== false
  try {
    if (showLoading) {
      renderLoadingState()
    }

    const response = await fetch('/api/subscriptions')
    if (!response.ok)
      throw new Error('載入失敗')

    const data = await response.json() as Api.SuccessResponse<Subscription[]>
    const _data = data.data && Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : [])
    subscriptionsCache.length = 0
    subscriptionsCache.push(..._data)

    populateCategoryFilter(subscriptionsCache)
    renderSubscriptionTable(subscriptionsCache, getSearchKeyword(), getCategoryFilter(), tableHandlers)
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('載入訂閱失敗:', error)
    renderErrorState('載入失敗，請刷新頁面重試')
    toast.error('載入訂閱列表失敗')
  }
}

function populateCategoryFilter(subscriptions: Subscription[]) {
  const select = document.getElementById('categoryFilter') as HTMLSelectElement | null
  if (!select)
    return

  const previousValue = select.value
  const categories = new Set<string>()

  subscriptions.forEach((sub) => {
    if (sub.category) {
      sub.category.split(/[\\/,\s]+/).forEach((token) => {
        const trimmed = token.trim()
        if (trimmed)
          categories.add(trimmed)
      })
    }
  })

  const sorted = Array.from(categories).sort((a, b) => {
    return a.localeCompare(b, 'zh-TW')
  })

  select.innerHTML = '<option value="">全部分類</option>'
  sorted.forEach((cat) => {
    const option = document.createElement('option')
    option.value = cat
    option.textContent = cat
    select.appendChild(option)
  })

  if (previousValue && sorted.includes(previousValue)) {
    select.value = previousValue
  }
}

// ===== 輔助函數 =====
function getSearchKeyword(): string {
  return ((document.getElementById('searchKeyword') as HTMLInputElement)?.value || '').trim().toLowerCase()
}

function getCategoryFilter(): string {
  return ((document.getElementById('categoryFilter') as HTMLInputElement)?.value || '').trim().toLowerCase()
}

const cancelBtn = document.getElementById('cancelBtn')
if (cancelBtn) {
  cancelBtn.addEventListener('click', closeModal)
}

function openAddModal() {
  const form = document.getElementById('subscriptionForm') as HTMLFormElement
  if (!form) {
    console.error('Subscription form not found')
    return
  }

  // 重置表單
  form.reset()

  // 使用批量設置函數設置預設值
  setFormValues(form, {
    subscriptionId: '',
    currency: 'TWD',
    periodUnit: 'month',
    periodValue: '1',
    periodMethod: 'credit',
    reminderMe: '1',
    isActive: true,
    autoRenew: true,
    hasEndDate: true,
    isReminderSet: true,
    isFreeTrial: false,
  })

  // 更新標題
  const modalTitle = document.getElementById('modalTitle')
  if (modalTitle) {
    modalTitle.textContent = '添加新訂閱'
  }

  // 打開 modal
  const modal = document.getElementById('subscriptionModal') as HTMLDialogElement
  modal?.showModal()
}

function closeModal() {
  (document.getElementById('subscriptionModal') as HTMLDialogElement).close()
}

// ===== 操作處理函數 =====
async function handleEdit(id: string) {
  try {
    // 優先使用快取
    let sub = getCacheItem(id)

    // 快取未命中時從 API 獲取
    if (!sub) {
      const response = await fetch('/api/subscriptions')
      if (!response.ok)
        throw new Error('獲取訂閱詳情失敗')

      const data = await response.json() as Api.SuccessResponse<Subscription[]>
      const subscriptions = data.data && Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : [])
      sub = subscriptions.find(s => s.id === id)
    }

    if (!sub) {
      throw new Error('訂閱不存在')
    }

    // 獲取表單
    const form = document.getElementById('subscriptionForm') as HTMLFormElement
    if (!form) {
      throw new Error('表單元素不存在')
    }

    // 使用 adaptor 轉換為表單格式
    const formValues = toFormFormat(sub)

    // 填充表單（需要添加 subscriptionId 字段）
    setFormValues(form, {
      subscriptionId: sub.id,
      ...formValues,
    })

    // 更新標題
    const modalTitle = document.getElementById('modalTitle')
    if (modalTitle) {
      modalTitle.textContent = '編輯訂閱'
    }

    // 打開 modal
    const modal = document.getElementById('subscriptionModal') as HTMLDialogElement
    modal?.showModal()
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('編輯訂閱失敗:', error)
    toast.error('獲取訂閱詳情失敗')
  }
}

async function handleDelete(id: string) {
  const confirmed = await window.confirmDialog(
    '刪除訂閱',
    '確定要刪除這個訂閱嗎？此操作不可恢復。',
    { variant: 'danger' },
  )
  if (!confirmed) {
    return
  }

  try {
    const response = await fetch(`/api/subscriptions/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json() as { message?: string }
      throw new Error(error.message || '刪除失敗')
    }

    toast.success('刪除成功')

    // 派發刪除事件
    document.dispatchEvent(new CustomEvent('subscription-deleted', {
      detail: { subscriptionId: id },
    }))
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('刪除失敗:', error)
    toast.error(error instanceof Error ? error.message : '刪除失敗，請稍後再試')
    // 失敗時重新載入以確保一致性
    await loadSubscriptions(false)
  }
}

async function handleToggleStatus(id: string, targetStatus: boolean) {
  try {
    const response = await fetch(`/api/subscriptions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: targetStatus }),
    })

    if (!response.ok) {
      const error = await response.json() as { message?: string }
      throw new Error(error.message || '操作失敗')
    }

    toast.success(targetStatus ? '啟用成功' : '停用成功')

    // 派發狀態變更事件
    document.dispatchEvent(new CustomEvent('subscription-status-changed', {
      detail: { subscriptionId: id, isActive: targetStatus },
    }))
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('切換狀態失敗:', error)
    toast.error(error instanceof Error ? error.message : '操作失敗，請稍後再試')
    // 失敗時重新載入以確保一致性
    await loadSubscriptions(false)
  }
}

async function handleTestNotify(id: string) {
  try {
    const response = await fetch(`/api/subscriptions/${id}/test`, {
      method: 'POST',
    })

    if (!response.ok) {
      const error = await response.json() as { message?: string }
      throw new Error(error.message || '發送失敗')
    }

    const result = await response.json() as { message?: string }
    toast.success(result.message || '測試通知已發送')
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('測試通知失敗:', error)
    toast.error(error instanceof Error ? error.message : '發送測試通知失敗')
  }
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  loadSubscriptions()
  attachEventListeners()
})

// ===== 事件綁定 =====
function attachEventListeners() {
  const searchInput = document.getElementById('searchKeyword')
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
      }
      searchDebounceTimer = setTimeout(() => {
        renderSubscriptionTable(subscriptionsCache, getSearchKeyword(), getCategoryFilter(), tableHandlers)
      }, 300)
    })
  }

  const categorySelect = document.getElementById('categoryFilter')
  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      renderSubscriptionTable(subscriptionsCache, getSearchKeyword(), getCategoryFilter(), tableHandlers)
    })
  }

  const addBtn = document.getElementById('addSubscriptionBtn')
  if (addBtn) {
    addBtn.addEventListener('click', openAddModal)
  }

  const cancelBtn = document.getElementById('cancelBtn')
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal)
  }

  // ===== 自定義事件監聽 =====
  document.addEventListener('subscription-saved', () => {
    loadSubscriptions(false)
  })

  document.addEventListener('subscription-deleted', (event) => {
    const customEvent = event as CustomEvent<{ subscriptionId: string }>
    removeCacheItem(customEvent.detail.subscriptionId)
  })

  document.addEventListener('subscription-status-changed', (event) => {
    const customEvent = event as CustomEvent<{ subscriptionId: string, isActive: boolean }>
    updateCacheItem(customEvent.detail.subscriptionId, {
      isActive: customEvent.detail.isActive,
    })
  })
}
