# 前端 Island 重構 (P3–P6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 將 `admin` / `config` / `login` 三個 island 與 `formAdaptor` 改用 P1 已建立的 client 共用 lib 層（`api` / `dom` / `async-ui` / `icons` / `store`），消除重複的 fetch 樣板、防禦式 envelope 解析、按鈕 loading 樣板、`window.x` 全域暴露、inline `onclick=""`、`innerHTML` 字串渲染，以及所有 `as any` / `as unknown as`。維持既有視覺與行為穩定（視覺提升留待 PV 階段），讓重構可與 S0 baseline 截圖對比、隔離回歸。

**Architecture:** 維持 Hono SSR pages/components + Vite island scripts 的既有分層。Island 腳本（`src/client/admin|config|login`）改為**只負責 DOM 接線與事件協調**，所有跨切面邏輯（API 呼叫、loading 狀態、icon 初始化、狀態容器）一律委派給 `src/client/lib/*`。Passkey 列表從 `innerHTML` 字串改為 `hono/jsx/dom` 元件（`src/components/config/PasskeyList.tsx` + `PasskeyItem.tsx`），透過 `mount()` 渲染。admin 的 `window`-global cache + 3 個 CustomEvent 改由單一 `createStore<Subscription[]>` 取代，store 訂閱者負責重繪表格。

**Tech Stack:** Cloudflare Workers + Hono + Vite + TypeScript（strict，禁用 `any`）；client 渲染層 `hono/jsx/dom`；UI 為 Tailwind v4 + DaisyUI；icon 為 lucide（經 `lib/icons` 的 `renderIcons`）；測試為 vitest（僅 `formAdaptor` 這類純函數受測）；套件管理 bun。

**P1 lib 層 API（本計畫假設已存在，簽名固定）：**
- `import { api, ApiError } from '../lib/api'` — `api.get<T>(path)`、`api.post<T>(path, body)`、`api.put<T>(path, body)`、`api.delete<T>(path)`；失敗丟 `ApiError`（含 `.message` 與 `.status`）；成功回傳已解開 envelope 的 `data`（型別 `T`）。
- `import { el, elx, els, mount } from '../lib/dom'` — `el<T>(id): T | null`、`elx<T>(id): T`（找不到拋出）、`els<T>(selector): T[]`、`mount(target, vnode): void`（包裝 `render` 並先清空）。
- `import { withLoading } from '../lib/async-ui'` — `withLoading<T>({ button?, show?, hide? }, fn): Promise<T>`；自動禁用 `button`、`show` 內元素加 `hidden` 之反向（移除 `hidden`）、`hide` 內元素加 `hidden`，`finally` 還原。
- `import { renderIcons } from '../lib/icons'` — `renderIcons(root?: ParentNode): void`，單一 lucide 初始化入口。
- `import { createStore } from '../lib/store'` — `createStore<T>(initial)` → `{ get, set, subscribe }`；`set` 接受新值或 `(prev) => next`；`subscribe(fn)` 立即/變更時呼叫並回傳 unsubscribe。

> **DOM island 不寫單元測試（spec §2 非目標、§7）。** P3–P5 為機械式重構，驗證方式為 `bun run typecheck && bun run build` 通過 + `bun run preview` 手動目視。**只有 P6 `formAdaptor`（純函數）採 TDD（先寫測試 RED → 改實作 GREEN）並跑 `bun run test`。** 這個區別在每個 Task 的驗證步驟中明確標示。

---

## File Structure

| 檔案 | 動作 | 職責 |
|------|------|------|
| `src/client/admin/index.ts` | 修改 | 改用 `createStore<Subscription[]>` 取代 `window`-global cache + 3 CustomEvent；所有 fetch 改走 `api`；移除重複 envelope 防禦解析；保留 `<SubscriptionTable>` 渲染 |
| `src/client/admin/subscriptionModal.ts` | 修改 | 表單送出改走 `api.post`/`api.put`；按鈕 loading 改 `withLoading`；改用 `el`/`elx`；移除 `subscription-saved` 等 CustomEvent，改呼叫 store 提供的 reload |
| `src/client/admin/tableRenderer.tsx` | 修改 | icon 初始化改用 `renderIcons`；DOM 取得改用 `elx`；`render` 包裝改用 `mount` |
| `src/client/config/index.ts` | 修改 | 所有 fetch 改走 `api`；`loadConfig` 以 `Config` 型別取代 `as any`/`as unknown as`；`loadPasskeys` 改用 `<PasskeyList>` 元件；移除 `window.registerPasskey`/`deletePasskey`/`editPasskeyNickname` 與 inline `onclick`；按鈕 loading 改 `withLoading` |
| `src/components/config/PasskeyList.tsx` | 新增 | `hono/jsx/dom` 元件，渲染 passkey 列表 / 空狀態，取代 `innerHTML` 字串；接收 `onRegister`/`onEdit`/`onDelete` handler |
| `src/components/config/PasskeyItem.tsx` | 新增 | `hono/jsx/dom` 元件，單筆 passkey 卡片，`onClick` 綁定（取代 inline `onclick`） |
| `src/client/login/index.ts` | 修改 | 登入 fetch 改走 `api.post`；按鈕 loading 改 `withLoading`；改用 `el` |
| `src/client/login/webauthn.ts` | 修改 | WebAuthn options/verify fetch 改走 `api`；按鈕 loading 改 `withLoading`；改用 `el` |
| `src/utils/formAdaptor.ts` | 修改 | `periodMethod ... as any` 改為 `Subscription['periodMethod']` 正確型別 |
| `src/utils/formAdaptor.test.ts` | 新增 | `toApiFormat` / `toFormFormat` 單元測試（TDD，純函數） |

---

## Task 1 — admin island：store + lib（P3）

**Files:** `src/client/admin/index.ts`、`src/client/admin/tableRenderer.tsx`、`src/client/admin/subscriptionModal.ts`

目標：以單一 `createStore<Subscription[]>` 取代 `subscriptionsCache` 陣列 + 三個 CustomEvent（`subscription-saved` / `subscription-deleted` / `subscription-status-changed`）。所有 fetch 改走 `api`，移除 `data.data && Array.isArray(...)` 防禦解析（`api` 已統一解開 envelope）。保留既有 `renderSubscriptionTable` / `<SubscriptionTable>` 渲染。

- [ ] **Step 1** — `tableRenderer.tsx`：改用 `lib/icons` 與 `lib/dom`。將 `createIcons({ icons: { TriangleAlert }, ... })` 與直接 `render(...)` 換成 `renderIcons` 與 `mount`。替換整個檔案內容為：

```tsx
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

  mount(tbody, (
    <SubscriptionTable
      subscriptions={subscriptions}
      searchKeyword={searchKeyword}
      categoryFilter={categoryFilter}
      handlers={handlers}
    />
  ))

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
```

- [ ] **Step 2** — `index.ts`：建立 store 並移除 `window`-global cache 與快取工具。將原本 `let searchDebounceTimer`、`const subscriptionsCache`、`getCacheItem`、`updateCacheItem`、`removeCacheItem` 區段（檔案第 54–77 行）整段替換為以下（store + 訂閱重繪 + debounce 變數）：

```ts
import { createStore } from '../lib/store'

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
```

  > 說明：`store.subscribe` 取代了原本散落在 `updateCacheItem`/`removeCacheItem`/`loadSubscriptions` 中的手動 `renderSubscriptionTable` 呼叫；改用 immutable 更新（`map`/`filter`），不再 `splice`/原地賦值。

- [ ] **Step 3** — `index.ts`：將 `import` 區塊補上 `api` 與 `ApiError`（保留既有 `Subscription` / `toFormFormat` / `toast` / tableRenderer 匯入），檔案頂端改為：

```ts
import type { Subscription } from '../../types/index'
import { toFormFormat } from '../../utils/formAdaptor'
import { toast } from '../../utils/toast'
import { api, ApiError } from '../lib/api'
import { el } from '../lib/dom'
import { createStore } from '../lib/store'
import { renderErrorState, renderLoadingState, renderSubscriptionTable } from './tableRenderer'
```

  > 注意：`createStore` 已在 Step 2 區塊內被 import 引用；合併到頂端 import 區，不要重複宣告。Step 2 區塊內的 `import { createStore } ...` 行請刪除，只保留頂端這份。

- [ ] **Step 4** — `index.ts`：重寫 `loadSubscriptions`，改走 `api.get`、寫入 store、移除 envelope 防禦解析與 `subscriptionsCache.length = 0` 等原地操作：

```ts
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
```

  > `store.set` 觸發 `subscribe` 重繪，故不再於此手動呼叫 `renderSubscriptionTable`。`populateCategoryFilter` 先於 `store.set` 呼叫以確保下拉選單在重繪前就緒。

- [ ] **Step 5** — `index.ts`：`populateCategoryFilter` 改用 `el` 取代 `getElementById ... as`：

```ts
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
```

- [ ] **Step 6** — `index.ts`：`getSearchKeyword` / `getCategoryFilter` 改用 `el`，並移除檔案中 module top-level（第 150–153 行）那段重複的 `const cancelBtn = document.getElementById('cancelBtn')` 綁定（其在 `attachEventListeners` 內已重複綁定一次）：

```ts
function getSearchKeyword(): string {
  return (el<HTMLInputElement>('searchKeyword')?.value || '').trim().toLowerCase()
}

function getCategoryFilter(): string {
  return (el<HTMLSelectElement>('categoryFilter')?.value || '').trim().toLowerCase()
}
```

  > 刪除原第 150–153 行的 module top-level `cancelBtn` 綁定區塊（保留 `attachEventListeners` 內的版本）。

- [ ] **Step 7** — `index.ts`：`openAddModal` 改用 `el`/`elx` 取代 `as HTMLFormElement`/`as HTMLDialogElement`：

```ts
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
```

- [ ] **Step 8** — `index.ts`：重寫 `handleEdit`，改走 `api.get`、用 `getCacheItem` 命中 store、移除 envelope 防禦解析：

```ts
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
```

- [ ] **Step 9** — `index.ts`：重寫 `handleDelete` / `handleToggleStatus` / `handleTestNotify`，改走 `api.delete` / `api.put` / `api.post`，刪除 CustomEvent 派發，直接改 store 並在失敗時 reload：

```ts
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
    await api.put<Subscription>(`/api/subscriptions/${id}`, { isActive: targetStatus })
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
    const result = await api.post<{ message?: string }>(`/api/subscriptions/${id}/test`)
    toast.success(result?.message || '測試通知已發送')
  }
  catch (error) {
    toast.error(error instanceof ApiError ? error.message : '發送測試通知失敗')
  }
}
```

  > 移除原本三個 `document.dispatchEvent(new CustomEvent(...))` 呼叫；改為直接呼叫 `removeCacheItem` / `updateCacheItem`（兩者經 `store.set` → `subscribe` 自動重繪）。

- [ ] **Step 10** — `index.ts`：重寫 `attachEventListeners`，改用 `el`、移除三個 `document.addEventListener('subscription-*')` CustomEvent 監聽（store 已取代）：

```ts
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
```

- [ ] **Step 11** — `subscriptionModal.ts`：因 admin store 取代了 `subscription-saved` CustomEvent，需提供一個讓 modal 表單在儲存成功後通知 admin 重載的途徑。最小變更做法：在 `index.ts` 將 `loadSubscriptions` 掛到一個明確的模組函式並由 modal 直接呼叫，不再經 CustomEvent。於 `index.ts` 底部 `attachEventListeners()` 呼叫處附近新增匯出：

```ts
// ===== 提供給 subscriptionModal 的重載入口（取代 subscription-saved CustomEvent） =====
export function reloadSubscriptions(): Promise<void> {
  return loadSubscriptions(false)
}
```

  並維持 `index.ts` 既有初始化：

```ts
// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  loadSubscriptions()
  attachEventListeners()
})
```

- [ ] **Step 12** — `subscriptionModal.ts`：整檔改用 `api.post`/`api.put` + `withLoading` + `el`/`elx`，移除 `subscription-saved` / `subscription-save-failed` CustomEvent，改呼叫 `reloadSubscriptions`。替換整個檔案內容為：

```ts
import { toApiFormat } from '../../utils/formAdaptor'
import { toast } from '../../utils/toast'
import { api, ApiError } from '../lib/api'
import { withLoading } from '../lib/async-ui'
import { el, elx } from '../lib/dom'
import { reloadSubscriptions } from './index'

const subscriptionForm = elx<HTMLFormElement>('subscriptionForm')
const hasEndDateToggle = elx<HTMLInputElement>('hasEndDate')
const expiryDateField = elx<HTMLLabelElement>('expiryDateField')
const expiryDateInput = elx<HTMLInputElement>('expiryDate')

function toggleExpiryDateField() {
  if (hasEndDateToggle.checked) {
    expiryDateField.style.display = ''
    expiryDateInput.required = true
  }
  else {
    expiryDateField.style.display = 'none'
    expiryDateInput.required = false
  }
}

toggleExpiryDateField()
hasEndDateToggle.addEventListener('change', toggleExpiryDateField)
subscriptionForm.addEventListener('submit', handleFormSubmit)

async function handleFormSubmit(evt: Event) {
  evt.preventDefault()

  const formDataObj = new FormData(subscriptionForm)
  const submitBtn = subscriptionForm.querySelector<HTMLButtonElement>('button[type="submit"]')
  const submitText = el('submitText')
  const submitLoading = el('submitLoading')

  const id = (formDataObj.get('id') as string) || ''

  try {
    const data = toApiFormat(formDataObj)

    if (!data.name) {
      throw new Error('請輸入訂閱名稱')
    }
    if (!data.expiryDate) {
      throw new Error('請選擇到期日期')
    }
    if (!data.periodValue || data.periodValue < 1) {
      throw new Error('周期數值必須大於 0')
    }

    await withLoading(
      { button: submitBtn, hide: [submitText], show: [submitLoading] },
      async () => {
        if (id) {
          await api.put<Subscription>(`/api/subscriptions/${id}`, data)
        }
        else {
          await api.post<Subscription>('/api/subscriptions', data)
        }
      },
    )

    toast.success(id ? '更新成功' : '添加成功')
    el<HTMLDialogElement>('subscriptionModal')?.close()
    await reloadSubscriptions()
  }
  catch (error) {
    toast.error(error instanceof ApiError ? error.message : '保存失敗，請稍後再試')
  }
}
```

  > 需在頂端補 `import type { Subscription } from '../../types/index'`（供 `api.put<Subscription>` 泛型）。`withLoading` 的 `show`/`hide` 語義：`hide` 內元素加 `hidden`（隱藏文字），`show` 內元素移除 `hidden`（顯示 spinner），`finally` 由 `withLoading` 還原，故不再需要手動 `finally` 還原樣板。

- [ ] **Step 13** — 驗證（DOM island，**不寫單元測試**）：

```bash
bun run typecheck && bun run build
```

  手動目視：`bun run preview` 後於 `/admin` 確認列表載入、搜尋/分類過濾、新增/編輯/刪除/啟停用/測試通知、modal 開關行為與重構前一致。

- [ ] **Step 14** — Commit：

```bash
git add src/client/admin/
git commit -m "refactor(subscriptions): migrate admin island to lib layer with store"
```

---

## Task 2 — config island + PasskeyList/PasskeyItem 元件（P4）

**Files:** `src/components/config/PasskeyList.tsx`（新增）、`src/components/config/PasskeyItem.tsx`（新增）、`src/client/config/index.ts`（修改）

目標：建立 `hono/jsx/dom` 元件取代 `loadPasskeys` 的 `innerHTML` 字串；移除 `window.registerPasskey`/`deletePasskey`/`editPasskeyNickname` 全域與 inline `onclick=""`；所有 fetch 改走 `api`；按鈕 loading 改 `withLoading`；用 `Config` 型別徹底消除 `loadConfig` 內的 `as any` / `as unknown as`。

credentials 端點回傳型別為 `Omit<StoredCredential, 'publicKey'>[]`（見 `src/routes/webauthn.ts:430` 的 `safeCredentials`），元件據此型別化，不使用 `any`。

- [ ] **Step 1** — 新增 `src/components/config/PasskeyItem.tsx`（單筆 passkey 卡片，`onClick` 取代 inline onclick）：

```tsx
/** @jsxImportSource hono/jsx/dom */
import type { StoredCredential } from '../../types/webauthn'

export type PasskeyCredential = Omit<StoredCredential, 'publicKey'>

interface PasskeyItemProps {
  credential: PasskeyCredential
  onEdit: (credentialID: string) => void
  onDelete: (credentialID: string) => void
}

export function PasskeyItem({ credential, onEdit, onDelete }: PasskeyItemProps) {
  const createdAt = new Date(credential.createdAt).toLocaleString('zh-TW')
  const lastUsedAt = credential.lastUsedAt
    ? new Date(credential.lastUsedAt).toLocaleString('zh-TW')
    : null
  const transports = credential.transports?.length ? credential.transports.join(', ') : null

  return (
    <div class="card bg-base-200">
      <div class="card-body p-4">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h5 class="font-semibold text-base">
              {credential.nickname || '未命名 Passkey'}
            </h5>
            <div class="text-sm text-base-content/70 mt-1">
              <div>
                建立於：
                {createdAt}
              </div>
              {lastUsedAt && (
                <div>
                  最後使用：
                  {lastUsedAt}
                </div>
              )}
              {transports && (
                <div>
                  傳輸方式：
                  {transports}
                </div>
              )}
            </div>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              onClick={() => onEdit(credential.credentialID)}
            >
              <i data-lucide="edit-3" class="size-4" />
            </button>
            <button
              type="button"
              class="btn btn-error btn-sm"
              onClick={() => onDelete(credential.credentialID)}
            >
              <i data-lucide="trash-2" class="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2** — 新增 `src/components/config/PasskeyList.tsx`（列表 + 空狀態，取代 `innerHTML` 字串；空狀態的「註冊第一個」按鈕改 `onClick`）：

```tsx
/** @jsxImportSource hono/jsx/dom */
import type { PasskeyCredential } from './PasskeyItem'
import { PasskeyItem } from './PasskeyItem'

interface PasskeyListProps {
  credentials: PasskeyCredential[]
  onRegister: () => void
  onEdit: (credentialID: string) => void
  onDelete: (credentialID: string) => void
}

export function PasskeyList({ credentials, onRegister, onEdit, onDelete }: PasskeyListProps) {
  if (credentials.length === 0) {
    return (
      <div class="card bg-base-200 border-2 border-dashed border-base-300">
        <div class="card-body items-center text-center py-12">
          <div class="bg-primary/10 rounded-full p-4 mb-4">
            <i data-lucide="fingerprint" class="size-12 text-primary" />
          </div>
          <h5 class="font-semibold text-lg">尚未註冊 Passkey</h5>
          <p class="text-sm text-base-content/70 max-w-md mt-2">
            Passkey 讓您可以使用指紋、臉部辨識或安全金鑰快速登入，無需記憶密碼
          </p>
          <button type="button" class="btn btn-primary btn-sm mt-4" onClick={onRegister}>
            <i data-lucide="plus" class="size-4" />
            註冊第一個 Passkey
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {credentials.map(credential => (
        <PasskeyItem
          key={credential.credentialID}
          credential={credential}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 3** — `config/index.ts`：替換頂端 import 與移除 `Window.lucide` 宣告（`renderIcons` 取代全域 lucide）。檔案頂端改為：

```ts
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser'
import type { Config } from '../../types/index'
import type { PasskeyCredential } from '../../components/config/PasskeyItem'
import { startRegistration } from '@simplewebauthn/browser'
import { PasskeyList } from '../../components/config/PasskeyList'
import { toast } from '../../utils/toast'
import { api, ApiError } from '../lib/api'
import { withLoading } from '../lib/async-ui'
import { el, elx, els, mount } from '../lib/dom'
import { renderIcons } from '../lib/icons'
```

  > 刪除原第 5–12 行的 `declare global { interface Window { lucide?: ... } }` 區塊。

- [ ] **Step 4** — `config/index.ts`：重寫 `loadConfig`，改走 `api.get<Config>`，以 `Config` 型別存取欄位，所有 `as unknown as HTMLSelectElement` / `as any` 改用 `elx`/`el` 的泛型；`config` 不再是 `any`：

```ts
async function loadConfig(): Promise<void> {
  try {
    const config = await api.get<Config>('/api/config')

    elx<HTMLInputElement>('adminUsername').value = config.ADMIN_USERNAME || ''
    const timezoneEl = el<HTMLSelectElement>('timezone')
    if (timezoneEl)
      timezoneEl.value = config.TIMEZONE || 'UTC'

    const hours = config.NOTIFICATION_HOURS || []
    elx<HTMLInputElement>('notificationHours').value = hours.length === 0 ? '*' : hours.join(', ')

    const reminderModeEl = el<HTMLSelectElement>('reminderMode')
    if (reminderModeEl)
      reminderModeEl.value = config.REMINDER_MODE || 'ONCE'

    elx<HTMLInputElement>('apiToken').value = config.API_TOKEN || ''

    const enabled = config.ENABLED_NOTIFIERS || ['notifyx']
    els<HTMLInputElement>('[name="ENABLED_NOTIFIERS"]').forEach((cb) => {
      cb.checked = enabled.includes(cb.value)
    })

    elx<HTMLInputElement>('tgBotToken').value = config.TELEGRAM_BOT_TOKEN || ''
    elx<HTMLInputElement>('tgChatId').value = config.TELEGRAM_CHAT_ID || ''

    elx<HTMLInputElement>('webhookUrl').value = config.WEBHOOK_URL || ''
    const webhookMethodEl = el<HTMLSelectElement>('webhookMethod')
    if (webhookMethodEl)
      webhookMethodEl.value = config.WEBHOOK_METHOD || 'POST'
    elx<HTMLTextAreaElement>('webhookHeaders').value = config.WEBHOOK_HEADERS || ''
    elx<HTMLTextAreaElement>('webhookTemplate').value = config.WEBHOOK_TEMPLATE || ''

    elx<HTMLInputElement>('resendApiKey').value = config.RESEND_API_KEY || ''
    elx<HTMLInputElement>('emailFrom').value = config.EMAIL_FROM || ''
    elx<HTMLInputElement>('emailFromName').value = config.EMAIL_FROM_NAME || ''
    elx<HTMLInputElement>('emailTo').value = config.EMAIL_TO || ''

    elx<HTMLInputElement>('barkServer').value = config.BARK_SERVER || 'https://api.day.app'
    elx<HTMLInputElement>('barkKey').value = config.BARK_KEY || ''
    elx<HTMLInputElement>('barkSave').checked = config.BARK_SAVE === 'true'
    elx<HTMLInputElement>('barkQuery').value = config.BARK_QUERY || ''

    elx<HTMLInputElement>('webauthnEnabled').checked = config.WEBAUTHN_ENABLED || false
    elx<HTMLInputElement>('webauthnRpName').value = config.WEBAUTHN_RP_NAME || 'SubsTracker'
    elx<HTMLInputElement>('webauthnRpId').value = config.WEBAUTHN_RP_ID || ''
    elx<HTMLTextAreaElement>('webauthnRpOrigins').value = (config.WEBAUTHN_RP_ORIGINS || []).join('\n')

    const attestationEl = el<HTMLSelectElement>('webauthnAttestation')
    if (attestationEl)
      attestationEl.value = config.WEBAUTHN_ATTESTATION || 'none'
    const authAttachmentEl = el<HTMLSelectElement>('webauthnAuthAttachment')
    if (authAttachmentEl)
      authAttachmentEl.value = config.WEBAUTHN_AUTHENTICATOR_ATTACHMENT || ''
    const residentKeyEl = el<HTMLSelectElement>('webauthnResidentKey')
    if (residentKeyEl)
      residentKeyEl.value = config.WEBAUTHN_RESIDENT_KEY || 'preferred'
    const userVerificationEl = el<HTMLSelectElement>('webauthnUserVerification')
    if (userVerificationEl)
      userVerificationEl.value = config.WEBAUTHN_USER_VERIFICATION || 'preferred'
    elx<HTMLInputElement>('webauthnTimeout').value = String(config.WEBAUTHN_TIMEOUT || 60000)

    const hints = config.WEBAUTHN_HINTS || []
    els<HTMLInputElement>('[name="WEBAUTHN_HINTS"]').forEach((checkbox) => {
      checkbox.checked = hints.includes(checkbox.value as Config['WEBAUTHN_HINTS'] extends Array<infer U> ? U : never)
    })

    toggleChannelConfigs(enabled)
    await loadPasskeys()
  }
  catch (error) {
    toast.error(`載入配置失敗：${error instanceof ApiError ? error.message : String(error)}`)
  }
}
```

  > `barkSave` 原本有 `=== true` 分支因 `Config.BARK_SAVE` 型別為 `string`，移除多餘的 `|| === true`。`WEBAUTHN_HINTS` 的 `includes` 改用 narrowing 而非 `as any`；若 conditional type 寫法在 lint 下過於冗長，替代方案為將 `hints` 視為 `string[]`（`const hints: string[] = config.WEBAUTHN_HINTS || []`）後再 `includes(checkbox.value)`，同樣無 `any`。實作時擇一，務必無 `any`。
  >
  > timezone 以 `const timezoneEl = el<HTMLSelectElement>('timezone')` 取得後設定 `.value`，不要用 `setAttribute('value', ...)`（對 `<select>` 無效）。

- [ ] **Step 5** — `config/index.ts`：重寫 `loadPasskeys`，改走 `api.get`、用 `mount(<PasskeyList ...>)` 取代 `innerHTML` 字串，icon 用 `renderIcons`：

```ts
async function loadPasskeys(): Promise<void> {
  const passkeyList = el('passkeyList')
  if (!passkeyList)
    return

  try {
    const credentials = await api.get<PasskeyCredential[]>('/api/webauthn/credentials')

    mount(passkeyList, (
      <PasskeyList
        credentials={credentials}
        onRegister={() => registerPasskey()}
        onEdit={editPasskeyNickname}
        onDelete={deletePasskey}
      />
    ))

    renderIcons(passkeyList)
  }
  catch {
    mount(passkeyList, <div class="text-center text-error py-8">載入失敗</div>)
  }
}
```

  > 此函式使用 JSX，故 `config/index.ts` 需在檔案頂端加入 `/** @jsxImportSource hono/jsx/dom */`（緊接於頂端 import 之上，與 `tableRenderer.tsx` 同慣例），並將檔案副檔名改為 `.tsx`：

```bash
git mv src/client/config/index.ts src/client/config/index.tsx
```

  改名後請檢查 `src/pages` / `vite` 對此 island 的引用路徑是否含副檔名；Vite 對 `.ts`/`.tsx` 解析無副檔名引用，通常無需改動，但仍需 `grep -rn "client/config" src/` 確認。

- [ ] **Step 6** — `config/index.tsx`：重寫 `registerPasskey`，改走 `api.post`、按鈕 loading 改 `withLoading`，移除 `clickedButton` 參數（空狀態按鈕的 loading 由頂部按鈕統一表示），移除手動 `finally` 還原樣板與 `error: any`：

```ts
async function registerPasskey(): Promise<void> {
  const registerBtn = el<HTMLButtonElement>('registerPasskeyBtn')
  const registerIcon = el('registerPasskeyIcon')
  const registerLoading = el('registerPasskeyLoading')

  try {
    await withLoading(
      { button: registerBtn, hide: [registerIcon], show: [registerLoading] },
      async () => {
        const options = await api.post<PublicKeyCredentialCreationOptionsJSON>(
          '/api/webauthn/register/options',
        )

        const credential = await startRegistration({ optionsJSON: options })

        await api.post<null>('/api/webauthn/register/verify', credential)
      },
    )

    toast.success('Passkey 註冊成功！')
    await loadPasskeys()
  }
  catch (error) {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      toast.error('註冊已取消')
    }
    else if (error instanceof Error && error.name === 'NotSupportedError') {
      toast.error('您的瀏覽器不支援 WebAuthn')
    }
    else {
      toast.error(error instanceof ApiError ? error.message : `註冊失敗: ${error instanceof Error ? error.message : '未知錯誤'}`)
    }
  }
}
```

  > `startRegistration` 必須在使用者手勢的同步呼叫鏈內。`withLoading` 內仍維持單一 async 函式鏈，手勢上下文不中斷（按鈕 disable 在 fn 執行前同步發生，符合 WebAuthn 要求）。

- [ ] **Step 7** — `config/index.tsx`：重寫 `deletePasskey` / `editPasskeyNickname`，改走 `api.delete` / `api.put`，移除 envelope 解析：

```ts
async function deletePasskey(credentialID: string): Promise<void> {
  if (!confirm('確定要刪除此 Passkey 嗎？此操作無法復原。')) {
    return
  }

  try {
    await api.delete<null>(`/api/webauthn/credentials/${credentialID}`)
    toast.success('Passkey 已刪除')
    await loadPasskeys()
  }
  catch (error) {
    toast.error(error instanceof ApiError ? error.message : '刪除失敗')
  }
}

async function editPasskeyNickname(credentialID: string): Promise<void> {
  const input = prompt('請輸入新的暱稱：')
  if (input === null) {
    toast.info('已取消更新暱稱')
    return
  }
  const nickname = input.trim()
  if (!nickname) {
    toast.error('暱稱不能為空')
    return
  }

  try {
    await api.put<null>(`/api/webauthn/credentials/${credentialID}`, { nickname })
    toast.success('暱稱更新成功')
    await loadPasskeys()
  }
  catch (error) {
    toast.error(error instanceof ApiError ? error.message : '更新失敗')
  }
}
```

- [ ] **Step 8** — `config/index.tsx`：重寫 `DOMContentLoaded` 初始化區塊，移除 `window.registerPasskey`/`deletePasskey`/`editPasskeyNickname` 全域暴露（元件 `onClick` 已直接綁定），表單送出改走 `api.put` + `withLoading`，移除 `setTimeout(loadConfig, 1000)` 改為 `await loadConfig()`，並用 `el`/`els` 取代 `as`。表單資料收集邏輯（`data` 物件）型別化為 `Partial<Config>` 取代 `Record<string, any>`：

```ts
document.addEventListener('DOMContentLoaded', () => {
  const form = el<HTMLFormElement>('configForm')
  const submitBtn = el<HTMLButtonElement>('submitBtn')
  const submitText = el('submitText')
  const submitLoading = el('submitLoading')

  if (!form || !submitBtn || !submitText || !submitLoading) {
    return
  }

  els<HTMLInputElement>('[name="ENABLED_NOTIFIERS"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const enabled = els<HTMLInputElement>('[name="ENABLED_NOTIFIERS"]:checked').map(elm => elm.value)
      toggleChannelConfigs(enabled)
    })
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    const password = elx<HTMLInputElement>('adminPassword').value.trim()
    const passwordConfirm = elx<HTMLInputElement>('adminPasswordConfirm').value.trim()
    const errorEl = el('passwordMismatchError')

    if (errorEl) {
      errorEl.style.display = 'none'
    }

    if (password || passwordConfirm) {
      if (password !== passwordConfirm) {
        if (errorEl) {
          errorEl.style.display = 'block'
        }
        toast.error('兩次輸入的密碼不一致，請重新輸入')
        return
      }
      if (password.length < 6) {
        toast.error('密碼至少需要 6 個字符')
        return
      }
    }

    try {
      const data = collectConfigFormData(form)

      await withLoading(
        { button: submitBtn, hide: [submitText], show: [submitLoading] },
        () => api.put<Config>('/api/config', data),
      )

      toast.success('配置保存成功')
      await loadConfig()
    }
    catch (error) {
      toast.error(`保存配置失敗：${error instanceof ApiError ? error.message : String(error)}`)
    }
  })

  el<HTMLButtonElement>('generateToken')?.addEventListener('click', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars[Math.floor(Math.random() * chars.length)]
    }
    elx<HTMLInputElement>('apiToken').value = token
    toast.success('令牌已生成')
  })

  el<HTMLButtonElement>('resetBtn')?.addEventListener('click', () => {
    if (confirm('確定要重置表單嗎？未保存的更改將丟失。')) {
      void loadConfig()
    }
  })

  void loadConfig()

  el<HTMLButtonElement>('registerPasskeyBtn')?.addEventListener('click', () => {
    void registerPasskey()
  })
})
```

  > 移除原第 315–318 行 `;(window as any).registerPasskey = ...` 等三行全域暴露。

- [ ] **Step 9** — `config/index.tsx`：抽出 `collectConfigFormData`（Step 8 引用），把原本 inline 的 `data: Record<string, any>` 收集邏輯改為回傳 `Partial<Config>` 的函式，徹底去 `any`：

```ts
function collectConfigFormData(form: HTMLFormElement): Partial<Config> {
  const formData = new FormData(form)
  const data: Partial<Config> = {}

  for (const [key, value] of formData.entries()) {
    if (
      key === 'ENABLED_NOTIFIERS'
      || key === 'WEBAUTHN_HINTS'
      || key === 'BARK_SAVE'
      || key === 'ADMIN_PASSWORD_CONFIRM'
    ) {
      continue
    }
    if (key === 'ADMIN_PASSWORD' && !value) {
      continue
    }
    if (key === 'WEBAUTHN_AUTHENTICATOR_ATTACHMENT') {
      if (value === '')
        continue
      data.WEBAUTHN_AUTHENTICATOR_ATTACHMENT = value as Config['WEBAUTHN_AUTHENTICATOR_ATTACHMENT']
      continue
    }
    if (key === 'WEBAUTHN_TIMEOUT') {
      const numValue = Number.parseInt(String(value), 10)
      if (!Number.isNaN(numValue) && numValue >= 10000 && numValue <= 600000) {
        data.WEBAUTHN_TIMEOUT = numValue
      }
      continue
    }
    // 其餘字串欄位：以 key 對應 Config 的字串型欄位
    ;(data as Record<string, string>)[key] = String(value)
  }

  data.ENABLED_NOTIFIERS = els<HTMLInputElement>('[name="ENABLED_NOTIFIERS"]:checked').map(elm => elm.value)

  const hoursInput = elx<HTMLInputElement>('notificationHours').value.trim()
  data.NOTIFICATION_HOURS = (hoursInput === '*' || !hoursInput)
    ? []
    : hoursInput
        .split(/[,\s]+/)
        .map(h => Number.parseInt(h, 10))
        .filter(h => !Number.isNaN(h) && h >= 0 && h <= 23)

  data.BARK_SAVE = elx<HTMLInputElement>('barkSave').checked ? 'true' : 'false'
  data.WEBAUTHN_ENABLED = elx<HTMLInputElement>('webauthnEnabled').checked

  const originsInput = elx<HTMLTextAreaElement>('webauthnRpOrigins').value.trim()
  data.WEBAUTHN_RP_ORIGINS = originsInput
    ? originsInput.split('\n').filter(line => line.trim())
    : []

  data.WEBAUTHN_HINTS = els<HTMLInputElement>('[name="WEBAUTHN_HINTS"]:checked')
    .map(elm => elm.value) as Config['WEBAUTHN_HINTS']

  return data
}
```

  > 唯一保留的型別斷言是 enum 字串欄位（`WEBAUTHN_AUTHENTICATOR_ATTACHMENT`、`WEBAUTHN_HINTS`）對其 union 字面量型別的 narrowing，以及泛型字串欄位的索引賦值 `as Record<string, string>`；**全程無 `any`**。若 reviewer 要求更嚴格，可改用 `zod` schema 解析 formData（非本任務必需）。

- [ ] **Step 10** — 驗證（DOM island，**不寫單元測試**）：

```bash
bun run typecheck && bun run build
```

  手動目視：`bun run preview` 後於 `/admin/config` 確認設定載入填值、渠道顯示切換、儲存、Passkey 列表（含空狀態）渲染、註冊/刪除/改暱稱按鈕，皆與重構前一致；DevTools console 確認無 `window.registerPasskey` 殘留引用。

- [ ] **Step 11** — Commit：

```bash
git add src/client/config/ src/components/config/
git commit -m "refactor(config): render passkeys via components and route through lib"
```

---

## Task 3 — login + webauthn island（P5）

**Files:** `src/client/login/index.ts`、`src/client/login/webauthn.ts`

目標：登入與 WebAuthn 認證 fetch 改走 `api`；按鈕 loading 改 `withLoading`，去除 4+ 份重複的禁用/切 icon/切 loading/finally 還原樣板；改用 `el`。

- [ ] **Step 1** — `login/index.ts`：整檔重寫，改用 `api.post` + `withLoading` + `el`，移除 `resetButtonState` 手動樣板：

```ts
import { toast } from '../../utils/toast'
import { getSafeRedirectUrl } from '../../utils/url'
import { api, ApiError } from '../lib/api'
import { withLoading } from '../lib/async-ui'
import { el } from '../lib/dom'
// 導入 WebAuthn 登入功能
import './webauthn'

const form = el<HTMLFormElement>('loginForm')
const btn = el<HTMLButtonElement>('submitBtn')
const btnText = el('btnText')
const btnLoading = el('btnLoading')
const errorMsg = el('errorMsg')
const errorText = el('errorText')

function showError(message: string) {
  if (!errorMsg || !errorText)
    return
  errorText.textContent = message
  errorMsg.classList.remove('hidden')
}

form?.addEventListener('submit', async (evt: Event) => {
  evt.preventDefault()

  const formData = new FormData(form)
  const username = formData.get('username')
  const password = formData.get('password')

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    showError('請輸入用戶名和密碼')
    return
  }

  errorMsg?.classList.add('hidden')

  try {
    await withLoading(
      { button: btn, hide: [btnText], show: [btnLoading] },
      () => api.post<{ username: string }>('/api/login', { username, password }),
    )

    const params = new URLSearchParams(window.location.search)
    window.location.href = getSafeRedirectUrl(params.get('redirect_to'))
  }
  catch (error) {
    showError(error instanceof ApiError ? error.message : '發生錯誤，請稍後再試')
  }
})
```

  > `api.post` 在 `success === false` 或非 2xx 時丟 `ApiError`，故成功路徑即為登入成功；不再需要 `data.success` 分支與 `resetButtonState`（`withLoading` 的 `finally` 已還原按鈕）。

  > 因 `toast` 未在此檔使用，若 lint 報未使用匯入，刪除 `import { toast }` 行。

- [ ] **Step 2** — `login/webauthn.ts`：整檔重寫，改用 `api.post` + `withLoading` + `el`，去除手動 loading 樣板與 `error: any`：

```ts
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { startAuthentication } from '@simplewebauthn/browser'
import { getSafeRedirectUrl } from '../../utils/url'
import { api, ApiError } from '../lib/api'
import { withLoading } from '../lib/async-ui'
import { el } from '../lib/dom'

const webauthnLoginBtn = el<HTMLButtonElement>('webauthnLoginBtn')
const usernameInput = el<HTMLInputElement>('username')
const errorMsgElement = el('errorMsg')
const errorTextElement = el('errorText')

function showWebAuthnError(message: string) {
  if (errorMsgElement && errorTextElement) {
    errorTextElement.textContent = message
    errorMsgElement.classList.remove('hidden')
  }
}

function hideWebAuthnError() {
  errorMsgElement?.classList.add('hidden')
}

webauthnLoginBtn?.addEventListener('click', async (e) => {
  e.preventDefault()
  hideWebAuthnError()

  const username = usernameInput?.value?.trim()
  if (!username) {
    showWebAuthnError('請先輸入用戶名')
    return
  }

  if (!window.PublicKeyCredential) {
    showWebAuthnError('您的瀏覽器不支援 WebAuthn')
    return
  }

  const webauthnIcon = el('webauthnLoginIcon')
  const webauthnLoading = el('webauthnLoginLoading')

  try {
    await withLoading(
      { button: webauthnLoginBtn, hide: [webauthnIcon], show: [webauthnLoading] },
      async () => {
        const options = await api.post<PublicKeyCredentialRequestOptionsJSON>(
          '/api/webauthn/authenticate/options',
          { username },
        )

        const credential = await startAuthentication({ optionsJSON: options })

        await api.post<null>('/api/webauthn/authenticate/verify', credential)
      },
    )

    const params = new URLSearchParams(window.location.search)
    window.location.href = getSafeRedirectUrl(params.get('redirect_to'))
  }
  catch (error) {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      hideWebAuthnError()
    }
    else if (error instanceof Error && error.name === 'NotSupportedError') {
      showWebAuthnError('您的瀏覽器不支援此功能')
    }
    else {
      showWebAuthnError(error instanceof ApiError ? error.message : `認證失敗: ${error instanceof Error ? error.message : '未知錯誤'}`)
    }
  }
})
```

  > `startAuthentication` 須在使用者手勢同步鏈內；`withLoading` 在 fn 執行前同步禁用按鈕，手勢上下文不中斷，符合 WebAuthn 要求。

- [ ] **Step 3** — 驗證（DOM island，**不寫單元測試**）：

```bash
bun run typecheck && bun run build
```

  手動目視：`bun run preview` 後於 `/`（login）確認密碼登入成功/失敗、WebAuthn 登入（含取消 `NotAllowedError` 靜默）、按鈕 loading 表現與重構前一致。

- [ ] **Step 4** — Commit：

```bash
git add src/client/login/
git commit -m "refactor(ui): route login and webauthn islands through lib layer"
```

---

## Task 4 — formAdaptor 型別修正 + 單元測試（P6，TDD）

**Files:** `src/utils/formAdaptor.ts`（修改）、`src/utils/formAdaptor.test.ts`（新增）

目標：消除 `periodMethod ... as any`，改用 `Subscription['periodMethod']` 正確型別；對純函數 `toApiFormat` / `toFormFormat` 採 **TDD（先寫測試 RED → 改實作 GREEN）**。這是本計畫**唯一**寫單元測試的 Task（DOM island 不寫）。

- [ ] **Step 1（RED）** — 新增 `src/utils/formAdaptor.test.ts`，先寫測試（此時 `as any` 仍在，但測試覆蓋行為使重構安全）。建立 FormData 的小工具與雙向轉換斷言：

```ts
import type { Subscription } from '../types'
import { describe, expect, it } from 'vitest'
import { toApiFormat, toFormFormat } from './formAdaptor'

function makeFormData(entries: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) {
    fd.append(k, v)
  }
  return fd
}

describe('toApiFormat', () => {
  it('maps basic string fields and trims to undefined when blank', () => {
    const fd = makeFormData({
      name: '  Netflix  ',
      customType: '',
      category: 'Streaming',
      currency: 'TWD',
      price: '390',
      periodValue: '1',
      periodUnit: 'month',
      periodMethod: 'credit',
      expiryDate: '2024-12-20',
    })

    const result = toApiFormat(fd)

    expect(result.name).toBe('Netflix')
    expect(result.customType).toBeUndefined()
    expect(result.category).toBe('Streaming')
    expect(result.periodValue).toBe(1)
    expect(result.periodUnit).toBe('month')
    expect(result.periodMethod).toBe('credit')
  })

  it('adds one day to expiryDate and returns ISO string', () => {
    const fd = makeFormData({ name: 'X', expiryDate: '2024-12-20' })
    const result = toApiFormat(fd)
    // +1 天
    expect(result.expiryDate?.startsWith('2024-12-21')).toBe(true)
  })

  it('converts checkbox "on" to true and absence to false', () => {
    const fd = makeFormData({ name: 'X', expiryDate: '2024-12-20', isActive: 'on' })
    const result = toApiFormat(fd)
    expect(result.isActive).toBe(true)
    expect(result.autoRenew).toBe(false)
    expect(result.isFreeTrial).toBe(false)
    expect(result.isReminderSet).toBe(false)
  })

  it('parses periodValue and reminderMe as numbers, undefined when invalid', () => {
    const fd = makeFormData({ name: 'X', expiryDate: '2024-12-20', periodValue: 'abc', reminderMe: '7' })
    const result = toApiFormat(fd)
    expect(result.periodValue).toBeUndefined()
    expect(result.reminderMe).toBe(7)
  })
})

describe('toFormFormat', () => {
  const base: Subscription = {
    id: 'sub_1',
    name: 'Netflix',
    expiryDate: '2024-12-21T00:00:00.000Z',
    autoRenew: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  it('subtracts one day from stored expiryDate for display', () => {
    const result = toFormFormat(base)
    expect(result.expiryDate).toBe('2024-12-20')
  })

  it('applies sensible defaults for optional fields', () => {
    const result = toFormFormat(base)
    expect(result.currency).toBe('TWD')
    expect(result.periodValue).toBe(1)
    expect(result.periodUnit).toBe('month')
    expect(result.periodMethod).toBe('credit')
    expect(result.reminderMe).toBe(1)
  })

  it('treats explicit false flags correctly', () => {
    const result = toFormFormat({ ...base, isActive: false, autoRenew: false, isFreeTrial: true, isReminderSet: false })
    expect(result.isActive).toBe(false)
    expect(result.autoRenew).toBe(false)
    expect(result.isFreeTrial).toBe(true)
    expect(result.isReminderSet).toBe(false)
  })

  it('round-trips periodMethod without losing the union type', () => {
    const result = toFormFormat({ ...base, periodMethod: 'paypal' })
    expect(result.periodMethod).toBe('paypal')
  })
})
```

  執行（應 RED 或部分通過，但確立行為基準）：

```bash
bun run test src/utils/formAdaptor.test.ts
```

- [ ] **Step 2（GREEN）** — `src/utils/formAdaptor.ts`：將 `FormValues.periodMethod` 與 `toApiFormat` 的 `as any` 換成 `Subscription['periodMethod']`。修改型別定義：

```ts
  // Period Settings
  periodValue: number
  periodUnit: 'day' | 'month' | 'year'
  periodMethod?: Subscription['periodMethod']
```

  並把 `toApiFormat` 內的：

```ts
    periodMethod: normalizeString(raw.periodMethod) as any,
```

  改為：

```ts
    periodMethod: normalizeString(raw.periodMethod) as Subscription['periodMethod'],
```

  > `normalizeString` 回傳 `string | undefined`；`Subscription['periodMethod']` 為 `'credit' | 'apple' | 'google' | 'paypal' | 'other' | undefined`。表單下拉值受 UI 限制於該 union，故以此單一 narrowing 斷言取代 `as any`，是型別正確且無 `any` 的最小變更。

- [ ] **Step 3（GREEN）** — 重跑測試，全綠：

```bash
bun run test src/utils/formAdaptor.test.ts
```

- [ ] **Step 4** — 全套驗證：

```bash
bun run typecheck && bun run test && bun run build
```

- [ ] **Step 5** — Commit：

```bash
git add src/utils/formAdaptor.ts src/utils/formAdaptor.test.ts
git commit -m "refactor(subscriptions): type periodMethod and add formAdaptor unit tests"
```

---

## Self-Review

**Spec 覆蓋（§3.2 + §8 P3–P6）**
- P3 admin（Task 1）：✅ `window`-global cache + 3 CustomEvent → `createStore<Subscription[]>`（Step 2/9/10）；✅ 全 fetch 走 `api`（Step 4/8/9）；✅ `withLoading`（於 Task 1 Step 12 的 modal 送出）；✅ 保留 `<SubscriptionTable>` 渲染（Step 1 維持 `SubscriptionTable`）；✅ 移除 `data.data && Array.isArray(...)` 防禦解析（Step 4/8）。
- P4 config（Task 2）：✅ 新增 `PasskeyList.tsx` + `PasskeyItem.tsx`（Step 1/2）以 `hono/jsx/dom` 取代 `innerHTML`（Step 5）；✅ 移除 `window.registerPasskey`/`deletePasskey`/`editPasskeyNickname` 與 inline `onclick`（Step 8 移除全域、元件改 `onClick`）；✅ 全走 `api`（Step 4–7）；✅ 以 `Config` 型別消除所有 `as any`/`as unknown as`（Step 4/9）。
- P5 login+webauthn（Task 3）：✅ 走 `api`、✅ `withLoading` 去重 loading（Step 1/2）。
- P6 formAdaptor（Task 4）：✅ `periodMethod ... as any` → `Subscription['periodMethod']`（Step 2）；✅ TDD 單元測試（Step 1 RED → Step 3 GREEN）。
- 測試邊界：✅ 明確標示 DOM island（P3–P5）不寫單元測試、僅 `typecheck + build + preview`；僅 `formAdaptor`（P6）TDD（見頂部 blockquote 與各 Task 驗證步驟）。

**Placeholder 掃描**
- 無 `TODO` / `FIXME` / `similar to above` / 省略片段；`PasskeyList`/`PasskeyItem` 與所有被替換的函式均給出完整程式碼。Task 2 Step 4 的 timezone 設定以 `.value` 完成（不用 `setAttribute`）；Step 5 含 `git mv` 至 `.tsx` 的明確指令。

**型別一致性 vs lib API 簽名**
- `api.get<T>` / `post<T>` / `put<T>` / `delete<T>` 回傳已解開的 `data: T`，計畫中所有呼叫皆以泛型標註預期 `data` 型別（`Subscription[]`、`Config`、`PasskeyCredential[]`、`PublicKeyCredentialCreationOptionsJSON`、`null` 等），不再 `as` envelope。
- `ApiError` 僅含 `message`/`status`，計畫一律以 `error instanceof ApiError ? error.message : fallback` 取訊息，無 `any`。
- `el<T>` 回傳 `T | null`（計畫對可選元素用 `el` + 判空或 `?.`）、`elx<T>` 對必存在元素直接用、`els<T>` 回傳陣列（用於 querySelectorAll 群組）、`mount(target, vnode)` 用於元件渲染。
- `withLoading({ button, show, hide }, fn)` 簽名一致：`button` 接 `HTMLButtonElement | null`、`show`/`hide` 接 `(HTMLElement | null)[]`，計畫傳入 `el(...)`（可能為 null）符合簽名。
- `createStore<T>`：`get`/`set(next | fn)`/`subscribe(fn) => unsub`，Task 1 對 `set` 同時使用直接值（`store.set(subscriptions)`）與 updater（`store.set(prev => ...)`），與簽名相符。
- `renderIcons(root?)`：Task 1/2 傳入容器節點作 scoped 重掃，符合簽名。
- 殘留型別斷言僅限 union 字面量 narrowing（`WEBAUTHN_*` enum 欄位、`periodMethod`）與字串索引賦值 `as Record<string, string>`，**全程無 `any`**，符合專案「一律不使用 any」與 spec §2 目標 3。
