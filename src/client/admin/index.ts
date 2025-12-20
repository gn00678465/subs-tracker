import type { Subscription } from '../../types/index'

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
    renderSubscriptionTable()
  }
}

function removeCacheItem(id: string): void {
  const index = subscriptionsCache.findIndex(sub => sub.id === id)
  if (index !== -1) {
    subscriptionsCache.splice(index, 1)
    renderSubscriptionTable()
  }
}

async function loadSubscriptions(showLoading: boolean = true) {
  showLoading = showLoading !== false
  try {
    const tbody = document.getElementById('subscriptionsBody')

    if (tbody && showLoading) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8"><span class="loading loading-spinner loading-lg"></span><p class="mt-2 text-base-content/70">載入中...</p></td></tr>'
    }

    const response = await fetch('/api/subscriptions')
    if (!response.ok)
      throw new Error('載入失敗')

    const data = await response.json() as Api.SuccessResponse<Subscription[]>
    const _data = data.data && Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : [])
    subscriptionsCache.splice(0, _data.length, ..._data)

    populateCategoryFilter(subscriptionsCache)
    renderSubscriptionTable()
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('載入訂閱失敗:', error)
    const tbody = document.getElementById('subscriptionsBody')
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-error"><svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><p>載入失敗，請刷新頁面重試</p></td></tr>'
    }
    window.showToast('載入訂閱列表失敗', 'error')
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
      sub.category.split(/[\\/,s]+/).forEach((token) => {
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

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function renderSubscriptionTable() {
  const tbody = document.getElementById('subscriptionsBody')
  if (!tbody)
    return

  const searchKeyword = ((document.getElementById('searchKeyword') as HTMLInputElement)?.value || '').trim().toLowerCase()
  const categoryFilter = ((document.getElementById('categoryFilter') as HTMLInputElement)?.value || '').trim().toLowerCase()

  let filtered = subscriptionsCache.slice()

  if (categoryFilter) {
    filtered = filtered.filter((sub) => {
      if (!sub.category)
        return false
      const tokens = sub.category.split(/[\\/,s]+/).map((t) => {
        return t.trim().toLowerCase()
      })
      return tokens.includes(categoryFilter)
    })
  }

  if (searchKeyword) {
    filtered = filtered.filter((sub) => {
      const haystack = [sub.name, sub.customType, sub.notes, sub.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(searchKeyword)
    })
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-base-content/70"><svg class="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg><p>沒有符合條件的訂閱</p></td></tr>'
    return
  }

  filtered.sort((a, b) => {
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
  })

  tbody.innerHTML = ''
  const currentTime = new Date()

  filtered.forEach((sub) => {
    const row = document.createElement('tr')
    row.className = sub.isActive === false ? 'opacity-60' : ''

    const expiryDate = new Date(sub.expiryDate)
    const diffMs = expiryDate.getTime() - currentTime.getTime()
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))

    const reminderValue = sub.reminderValue || 7
    const reminderUnit = sub.reminderUnit || 'day'
    const isSoon = reminderUnit === 'hour'
      ? diffHours >= 0 && diffHours <= reminderValue
      : diffDays >= 0 && diffDays <= reminderValue

    let statusBadge = ''
    if (!sub.isActive) {
      statusBadge = '<div class="badge badge-neutral gap-2">已停用</div>'
    }
    else if (diffDays < 0) {
      statusBadge = '<div class="badge badge-error gap-2">已過期</div>'
    }
    else if (isSoon) {
      statusBadge = '<div class="badge badge-warning gap-2">即將到期</div>'
    }
    else {
      statusBadge = '<div class="badge badge-success gap-2">正常</div>'
    }

    let daysLeftText = ''
    if (diffMs < 0) {
      const absDays = Math.abs(diffDays)
      daysLeftText = absDays >= 1
        ? `已過期 ${absDays} 天`
        : `已過期 ${Math.abs(diffHours)} 小時`
    }
    else if (diffDays >= 1) {
      daysLeftText = `還剩 ${diffDays} 天`
    }
    else {
      daysLeftText = diffHours > 0
        ? `約 ${diffHours} 小時後到期`
        : '即將到期'
    }

    const categoryBadges = sub.category
      ? sub.category.split(/[\\/,s]+/)
          .filter((t) => { return t.trim() })
          .map((cat) => {
            return `<div class="badge badge-outline badge-sm">${cat.trim()}</div>`
          })
          .join(' ')
      : ''

    const unitText = sub.periodUnit === 'day' ? '天' : (sub.periodUnit === 'month' ? '月' : '年')
    const reminderUnitText = reminderUnit === 'hour' ? '小時' : '天'

    row.innerHTML = `<td><div class="font-medium">${sub.name}</div>${
      sub.notes ? `<div class="text-sm text-base-content/70 mt-1">${sub.notes.length > 50 ? `${sub.notes.substring(0, 50)}...` : sub.notes}</div>` : ''
    }</td><td><div>${sub.customType || '其他'}</div>${
      sub.periodValue ? `<div class="text-sm text-base-content/70 mt-1">周期: ${sub.periodValue} ${unitText}</div>` : ''
    }${categoryBadges ? `<div class="flex flex-wrap gap-1 mt-2">${categoryBadges}</div>` : ''
    }</td><td><div>${formatDate(sub.expiryDate)}</div><div class="text-sm text-base-content/70 mt-1">${daysLeftText}</div>${
      sub.startDate ? `<div class="text-xs text-base-content/50 mt-1">開始: ${formatDate(sub.startDate)}</div>` : ''
    }</td><td><div>提前 ${reminderValue} ${reminderUnitText}</div>${
      reminderValue === 0 ? '<div class="text-sm text-base-content/70 mt-1">僅到期時提醒</div>' : ''
    }</td><td>${statusBadge
    }</td><td><div class="flex flex-wrap gap-1"><button class="btn btn-primary btn-xs" data-action="edit" data-subscription-id="${sub.id}" data-testid="edit-btn">編輯</button>`
    + `<button class="btn btn-info btn-xs" data-action="test-notify" data-subscription-id="${sub.id}" data-testid="test-notify-btn">測試</button>`
    + `<button class="btn btn-error btn-xs" data-action="delete" data-subscription-id="${sub.id}" data-testid="delete-btn">刪除</button>${
      sub.isActive
        ? `<button class="btn btn-warning btn-xs" data-action="toggle-status" data-subscription-id="${sub.id}" data-target-status="false" data-testid="toggle-status-btn">停用</button>`
        : `<button class="btn btn-success btn-xs" data-action="toggle-status" data-subscription-id="${sub.id}" data-target-status="true" data-testid="toggle-status-btn">啟用</button>`
    }</div></td>`

    tbody.appendChild(row)
  })
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

    // 處理到期日期：儲存的是實際過期時間（選定日期+1），顯示時需要-1天
    const expiryDateObj = new Date(sub.expiryDate)
    expiryDateObj.setDate(expiryDateObj.getDate() - 1)
    const displayExpiryDate = expiryDateObj.toISOString().split('T')[0]

    // 使用批量設置函數填充表單
    setFormValues(form, {
      subscriptionId: sub.id,
      name: sub.name,
      customType: sub.customType || '',
      category: sub.category || '',
      currency: sub.currency || 'TWD',
      price: sub.price || '',
      startDate: sub.startDate ? sub.startDate.split('T')[0] : '',
      expiryDate: displayExpiryDate,
      periodValue: sub.periodValue || 1,
      periodUnit: sub.periodUnit || 'month',
      periodMethod: sub.periodMethod || 'credit',
      website: sub.website || '',
      reminderMe: sub.reminderMe || 1,
      notes: sub.notes || '',
      isActive: sub.isActive !== false,
      autoRenew: sub.autoRenew !== false,
      isFreeTrial: sub.isFreeTrial === true,
      isReminderSet: sub.isReminderSet !== false,
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
    window.showToast('獲取訂閱詳情失敗', 'error')
  }
}

async function handleDelete(id: string) {
  // eslint-disable-next-line no-alert
  if (!confirm('確定要刪除這個訂閱嗎？此操作不可恢復。')) {
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

    window.showToast('刪除成功', 'success')

    // 派發刪除事件
    document.dispatchEvent(new CustomEvent('subscription-deleted', {
      detail: { subscriptionId: id },
    }))
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('刪除失敗:', error)
    window.showToast(error instanceof Error ? error.message : '刪除失敗，請稍後再試', 'error')
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

    window.showToast(targetStatus ? '啟用成功' : '停用成功', 'success')

    // 派發狀態變更事件
    document.dispatchEvent(new CustomEvent('subscription-status-changed', {
      detail: { subscriptionId: id, isActive: targetStatus },
    }))
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('切換狀態失敗:', error)
    window.showToast(error instanceof Error ? error.message : '操作失敗，請稍後再試', 'error')
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
    window.showToast(result.message || '測試通知已發送', 'success')
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('測試通知失敗:', error)
    window.showToast(error instanceof Error ? error.message : '發送測試通知失敗', 'error')
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
        renderSubscriptionTable()
      }, 300)
    })
  }

  const categorySelect = document.getElementById('categoryFilter')
  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      renderSubscriptionTable()
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

  // ===== 事件委派：處理表格操作按鈕 =====
  const tbody = document.getElementById('subscriptionsBody')
  if (tbody) {
    tbody.addEventListener('click', async (event) => {
      const target = event.target as HTMLElement
      const button = target.closest('button[data-action]') as HTMLButtonElement

      if (!button)
        return

      const action = button.dataset.action
      const subscriptionId = button.dataset.subscriptionId

      if (!subscriptionId)
        return

      switch (action) {
        case 'edit':
          await handleEdit(subscriptionId)
          break
        case 'delete':
          await handleDelete(subscriptionId)
          break
        case 'toggle-status': {
          const targetStatus = button.dataset.targetStatus === 'true'
          await handleToggleStatus(subscriptionId, targetStatus)
          break
        }
        case 'test-notify':
          await handleTestNotify(subscriptionId)
          break
      }
    })
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
