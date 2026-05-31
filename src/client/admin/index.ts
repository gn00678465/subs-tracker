import type { Subscription } from '../../types/index'
import { toFormFormat } from '../../utils/formAdaptor'
import { toast } from '../../utils/toast'
import { api, ApiError } from '../lib/api'
import { el } from '../lib/dom'
import { createStore } from '../lib/store'
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

// ===== 狀態容器 =====
const store = createStore<Subscription[]>([])
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

function renderFromStore() {
  renderSubscriptionTable(store.get(), getSearchKeyword(), getCategoryFilter(), tableHandlers)
}

// store 變更即重繪表格
store.subscribe(() => {
  renderFromStore()
})

function getCacheItem(id: string): Subscription | undefined {
  return store.get().find(sub => sub.id === id)
}

function updateCacheItem(id: string, updates: Partial<Subscription>): void {
  store.set(prev => prev.map(sub => (sub.id === id ? { ...sub, ...updates } : sub)))
}

function removeCacheItem(id: string): void {
  store.set(prev => prev.filter(sub => sub.id !== id))
}

async function loadSubscriptions(showLoading: boolean = true) {
  try {
    if (showLoading) {
      renderLoadingState()
    }

    const subscriptions = await api.get<Subscription[]>('/api/subscriptions')

    populateCategoryFilter(subscriptions)
    store.set(subscriptions)
  }
  catch (error) {
    const message = error instanceof ApiError ? error.message : '載入失敗，請刷新頁面重試'
    renderErrorState(message)
    toast.error('載入訂閱列表失敗')
  }
}

function populateCategoryFilter(subscriptions: Subscription[]) {
  const select = el<HTMLSelectElement>('categoryFilter')
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

  const sorted = Array.from(categories).sort((a, b) => a.localeCompare(b, 'zh-TW'))

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
  return (el<HTMLInputElement>('searchKeyword')?.value || '').trim().toLowerCase()
}

function getCategoryFilter(): string {
  return (el<HTMLSelectElement>('categoryFilter')?.value || '').trim().toLowerCase()
}

function openAddModal() {
  const form = el<HTMLFormElement>('subscriptionForm')
  if (!form) {
    return
  }

  form.reset()

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

  const modalTitle = el('modalTitle')
  if (modalTitle) {
    modalTitle.textContent = '添加新訂閱'
  }

  el<HTMLDialogElement>('subscriptionModal')?.showModal()
}

function closeModal() {
  el<HTMLDialogElement>('subscriptionModal')?.close()
}

// ===== 操作處理函數 =====
async function handleEdit(id: string) {
  try {
    let sub = getCacheItem(id)

    if (!sub) {
      const subscriptions = await api.get<Subscription[]>('/api/subscriptions')
      sub = subscriptions.find(s => s.id === id)
    }

    if (!sub) {
      throw new Error('訂閱不存在')
    }

    const form = el<HTMLFormElement>('subscriptionForm')
    if (!form) {
      throw new Error('表單元素不存在')
    }

    const formValues = toFormFormat(sub)

    setFormValues(form, {
      subscriptionId: sub.id,
      ...formValues,
    })

    const modalTitle = el('modalTitle')
    if (modalTitle) {
      modalTitle.textContent = '編輯訂閱'
    }

    el<HTMLDialogElement>('subscriptionModal')?.showModal()
  }
  catch {
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
    await api.delete<null>(`/api/subscriptions/${id}`)
    toast.success('刪除成功')
    removeCacheItem(id)
  }
  catch (error) {
    toast.error(error instanceof ApiError ? error.message : '刪除失敗，請稍後再試')
    await loadSubscriptions(false)
  }
}

async function handleToggleStatus(id: string, targetStatus: boolean) {
  try {
    await api.put<Subscription>(`/api/subscriptions/${id}/toggle`, { isActive: targetStatus })
    toast.success(targetStatus ? '啟用成功' : '停用成功')
    updateCacheItem(id, { isActive: targetStatus })
  }
  catch (error) {
    toast.error(error instanceof ApiError ? error.message : '操作失敗，請稍後再試')
    await loadSubscriptions(false)
  }
}

async function handleTestNotify(id: string) {
  try {
    const result = await api.post<{ totalChannels: number, successCount: number, failureCount: number }>(`/api/subscriptions/${id}/test`)
    toast.success(`測試通知發送完成 (成功 ${result.successCount}/${result.totalChannels})`)
  }
  catch (error) {
    toast.error(error instanceof ApiError ? error.message : '發送測試通知失敗')
  }
}

// ===== 提供給 subscriptionModal 的重載入口（取代 subscription-saved CustomEvent） =====
export function reloadSubscriptions(): Promise<void> {
  return loadSubscriptions(false)
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  loadSubscriptions()
  attachEventListeners()
})

// ===== 事件綁定 =====
function attachEventListeners() {
  const searchInput = el('searchKeyword')
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer)
      }
      searchDebounceTimer = setTimeout(renderFromStore, 300)
    })
  }

  const categorySelect = el('categoryFilter')
  if (categorySelect) {
    categorySelect.addEventListener('change', renderFromStore)
  }

  const addBtn = el('addSubscriptionBtn')
  if (addBtn) {
    addBtn.addEventListener('click', openAddModal)
  }

  const cancelBtn = el('cancelBtn')
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeModal)
  }
}
