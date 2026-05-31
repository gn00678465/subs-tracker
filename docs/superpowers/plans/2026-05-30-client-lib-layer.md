# Client 共用 lib 層 (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 建立 `src/client/lib/` 共用基礎層（`api` / `dom` / `async-ui` / `icons` / `store`），消除目前 client island 中重複的 `fetch + envelope 解析 + try/catch`、按鈕 loading 樣板、手寫 `getElementById`、以及兩種 lucide 初始化寫法。本階段僅建立 lib 層本身與其單元測試，**不修改任何既有 island（admin / config / login）**；那些遷移由後續 island plan 處理。lib 層的簽名在此被釘死，使後續 island plan 能直接對齊。

**Architecture:** 維持既有分層（Hono SSR + Vite island scripts + `hono/jsx/dom` 渲染）。新增的 `src/client/lib/` 為純邏輯、可注入依賴（fetch 以參數注入）、可單元測試的模組集合。`api.ts` 統一解開後端 `{ success, data, message }` envelope（見 `src/utils/response.ts` 與 `src/types/api.d.ts`）；`dom.ts` 包裝 typed DOM 存取與 `hono/jsx/dom` 的 `render`；`async-ui.ts` 統一 async UI 狀態切換；`icons.ts` 收斂為單一 tree-shaken `createIcons` 策略；`store.ts` 提供極小可訂閱狀態容器。

**Tech Stack:** Cloudflare Workers + Hono + Vite + TypeScript（strict，**一律不使用 `any`**）；渲染層 `hono/jsx/dom`；測試 vitest + happy-dom（`@vitest/coverage-v8`）已於先前 P0 計畫 bootstrap；套件管理器 **bun**；圖示 `lucide`（tree-shaken）。

---

## File Structure

| 路徑 | 動作 | 說明 |
|------|------|------|
| `src/client/lib/api.ts` | Create | 統一 API 客戶端：`ApiError`、`createApi`、`api` |
| `src/client/lib/api.test.ts` | Create | `api` 單元測試（以 `vi.fn()` 注入 mock fetch） |
| `src/client/lib/dom.ts` | Create | typed DOM 存取：`el` / `elx` / `els` / `mount` |
| `src/client/lib/dom.test.ts` | Create | `dom` 單元測試（happy-dom） |
| `src/client/lib/async-ui.ts` | Create | 統一 async UI 狀態：`withLoading` |
| `src/client/lib/async-ui.test.ts` | Create | `async-ui` 單元測試（happy-dom） |
| `src/client/lib/store.ts` | Create | 極小狀態容器：`Store` / `createStore` |
| `src/client/lib/store.test.ts` | Create | `store` 單元測試 |
| `src/client/lib/icons.ts` | Create | 單一 lucide 初始化：`renderIcons` |
| `src/client/lib/icons.test.ts` | Create | `icons` 煙霧測試（happy-dom） |

> 約定：測試以 vitest 執行，指令為 `bun run test <path>`（vitest 在 `--run` 模式下對單一檔案執行；若先前 P0 設定的 `test` script 為 watch，請改用 `bun run test -- --run <path>`）。每個 Task 為一次完整 RED → GREEN → REFACTOR 並以一個 conventional commit 收尾。目標每個模組 ≥ 80% 行覆蓋。

---

### Task 1: `api.ts` — 統一 API 客戶端（TDD）

統一解開 `{ success, data, message }` envelope：HTTP 非 2xx 或 `success === false` 時丟 `ApiError(message, status)`；否則回傳 `data` 作為 `T`。fetch 以參數注入，測試以 `vi.fn()` 替身驗證 method / headers / body / signal 的傳遞與錯誤路徑。

**Files:**
- Create: `src/client/lib/api.ts`
- Test: `src/client/lib/api.test.ts`

- [ ] **Step 1**：先寫失敗測試 `src/client/lib/api.test.ts`，覆蓋成功解 envelope、`success === false` 丟錯、HTTP 非 2xx 丟錯、POST/PUT 帶 JSON body 與 header、DELETE 不帶 body、`signal` 透傳、以及回應非 JSON 時的處理。

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createApi } from './api'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('apiError', () => {
  it('帶有 message、status 與 name', () => {
    const err = new ApiError('壞掉了', 500)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('壞掉了')
    expect(err.status).toBe(500)
    expect(err.name).toBe('ApiError')
  })
})

describe('createApi', () => {
  let fetchImpl: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchImpl = vi.fn()
  })

  it('get 成功時回傳 envelope 內的 data', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: true, data: [{ id: '1' }] }))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    const result = await api.get<{ id: string }[]>('/api/subscriptions')

    expect(result).toEqual([{ id: '1' }])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/subscriptions')
    expect(init?.method).toBe('GET')
    expect(init?.body).toBeUndefined()
  })

  it('當 envelope 無 data 時回傳 undefined', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: true }))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    const result = await api.get<undefined>('/api/ping')

    expect(result).toBeUndefined()
  })

  it('success === false 時丟出 ApiError 含 message 與 status', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: false, message: '驗證失敗' }, 400))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    await expect(api.get('/api/subscriptions')).rejects.toMatchObject({
      name: 'ApiError',
      message: '驗證失敗',
      status: 400,
    })
  })

  it('HTTP 非 2xx 但 body 非 envelope 時，以狀態文字丟出 ApiError', async () => {
    fetchImpl.mockResolvedValue(new Response('Internal Server Error', { status: 500 }))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    await expect(api.get('/api/boom')).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
    })
  })

  it('200 但 success === false 也丟出 ApiError', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: false, message: '不允許' }, 200))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    await expect(api.get('/api/x')).rejects.toMatchObject({
      message: '不允許',
      status: 200,
    })
  })

  it('post 帶 JSON body 與 Content-Type header', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: true, data: { id: '9' } }, 201))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    const result = await api.post<{ id: string }>('/api/subscriptions', { name: 'Netflix' })

    expect(result).toEqual({ id: '9' })
    const [, init] = fetchImpl.mock.calls[0]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ name: 'Netflix' }))
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
  })

  it('put 帶 JSON body', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: true, data: { isActive: false } }))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    await api.put('/api/subscriptions/1', { isActive: false })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/subscriptions/1')
    expect(init?.method).toBe('PUT')
    expect(init?.body).toBe(JSON.stringify({ isActive: false }))
  })

  it('delete 不帶 body 也不帶 Content-Type', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: true }))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    await api.delete('/api/subscriptions/1')

    const [, init] = fetchImpl.mock.calls[0]
    expect(init?.method).toBe('DELETE')
    expect(init?.body).toBeUndefined()
    expect(new Headers(init?.headers).get('Content-Type')).toBeNull()
  })

  it('透傳 AbortSignal', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: true, data: null }))
    const api = createApi(fetchImpl as unknown as typeof fetch)
    const controller = new AbortController()

    await api.get('/api/subscriptions', { signal: controller.signal })

    const [, init] = fetchImpl.mock.calls[0]
    expect(init?.signal).toBe(controller.signal)
  })
})
```

- [ ] **Step 2**：執行測試，預期 **FAIL**（模組尚未建立）。
  ```bash
  bun run test src/client/lib/api.test.ts
  ```
  預期：所有 case 失敗（`Cannot find module './api'`）。

- [ ] **Step 3**：寫實作 `src/client/lib/api.ts` 使測試通過。

```ts
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

interface Envelope<T> {
  success: boolean
  data?: T
  message?: string
}

function isEnvelope(value: unknown): value is Envelope<unknown> {
  return typeof value === 'object' && value !== null && 'success' in value
}

export function createApi(fetchImpl: typeof fetch) {
  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, signal } = opts
    const headers: Record<string, string> = {}
    const hasBody = body !== undefined
    if (hasBody)
      headers['Content-Type'] = 'application/json'

    const response = await fetchImpl(path, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal,
    })

    let payload: unknown
    try {
      payload = await response.json()
    }
    catch {
      payload = undefined
    }

    if (isEnvelope(payload)) {
      if (!payload.success || !response.ok)
        throw new ApiError(payload.message ?? response.statusText, response.status)
      return payload.data as T
    }

    if (!response.ok)
      throw new ApiError(response.statusText || `HTTP ${response.status}`, response.status)

    return payload as T
  }

  return {
    get: <T>(path: string, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'GET' }),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'POST', body }),
    put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'PUT', body }),
    delete: <T>(path: string, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'DELETE' }),
  }
}

export const api = createApi(globalThis.fetch.bind(globalThis))
```

- [ ] **Step 4**：執行測試，預期 **PASS**。
  ```bash
  bun run test src/client/lib/api.test.ts
  ```
  預期：全部通過。

- [ ] **Step 5**：REFACTOR — 確認無 `any`、無多餘防禦、命名清楚；確認 `success === false`（即使 200）與非 2xx 兩條錯誤路徑都被測試覆蓋。再跑一次測試確認仍 PASS。

- [ ] **Step 6**：Commit。
  ```bash
  git add src/client/lib/api.ts src/client/lib/api.test.ts
  git commit -m "feat(lib): add unified api client with envelope unwrapping"
  ```

---

### Task 2: `dom.ts` — typed DOM 存取（TDD）

提供 `el`（可空）、`elx`（缺失即拋）、`els`（querySelectorAll → 陣列）、`mount`（清空目標後以 `hono/jsx/dom` `render`）。`mount` 接受目標 element 或 id 字串。

**Files:**
- Create: `src/client/lib/dom.ts`
- Test: `src/client/lib/dom.test.ts`

- [ ] **Step 1**：先寫失敗測試 `src/client/lib/dom.test.ts`。

```ts
/** @jsxImportSource hono/jsx/dom */
import { beforeEach, describe, expect, it } from 'vitest'
import { el, els, elx, mount } from './dom'

describe('el', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('找到元素時回傳該元素', () => {
    document.body.innerHTML = '<div id="target"></div>'
    const found = el<HTMLDivElement>('target')
    expect(found).toBeInstanceOf(HTMLDivElement)
    expect(found?.id).toBe('target')
  })

  it('找不到元素時回傳 null', () => {
    expect(el('missing')).toBeNull()
  })
})

describe('elx', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('找到元素時回傳該元素', () => {
    document.body.innerHTML = '<button id="save"></button>'
    expect(elx<HTMLButtonElement>('save')).toBeInstanceOf(HTMLButtonElement)
  })

  it('找不到元素時拋出含 id 的錯誤', () => {
    expect(() => elx('nope')).toThrow(/nope/)
  })
})

describe('els', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('回傳符合 selector 的元素陣列', () => {
    document.body.innerHTML = '<ul><li class="row"></li><li class="row"></li></ul>'
    const rows = els<HTMLLIElement>('.row')
    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toBeInstanceOf(HTMLLIElement)
  })

  it('無符合時回傳空陣列', () => {
    expect(els('.none')).toEqual([])
  })
})

describe('mount', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('清空目標元素後渲染 vnode', () => {
    document.body.innerHTML = '<div id="host"><span>舊內容</span></div>'
    const host = document.getElementById('host') as HTMLElement

    mount(host, <p class="fresh">新內容</p>)

    expect(host.querySelector('span')).toBeNull()
    const fresh = host.querySelector('.fresh')
    expect(fresh?.textContent).toBe('新內容')
  })

  it('可用 id 字串作為 target', () => {
    document.body.innerHTML = '<div id="host2"></div>'

    mount('host2', <b>x</b>)

    expect(document.getElementById('host2')?.querySelector('b')?.textContent).toBe('x')
  })

  it('target id 不存在時拋出', () => {
    expect(() => mount('ghost', <i>y</i>)).toThrow(/ghost/)
  })
})
```

- [ ] **Step 2**：執行測試，預期 **FAIL**。
  ```bash
  bun run test src/client/lib/dom.test.ts
  ```
  預期：失敗（`Cannot find module './dom'`）。

- [ ] **Step 3**：寫實作 `src/client/lib/dom.ts`。

```ts
/** @jsxImportSource hono/jsx/dom */
import { render } from 'hono/jsx/dom'

export function el<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null
}

export function elx<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found)
    throw new Error(`Element not found: #${id}`)
  return found as T
}

export function els<T extends HTMLElement>(selector: string): T[] {
  return Array.from(document.querySelectorAll<T>(selector))
}

export function mount(target: HTMLElement | string, vnode: unknown): void {
  const host = typeof target === 'string' ? elx(target) : target
  host.innerHTML = ''
  render(vnode as Parameters<typeof render>[0], host)
}
```

- [ ] **Step 4**：執行測試，預期 **PASS**。
  ```bash
  bun run test src/client/lib/dom.test.ts
  ```
  預期：全部通過。

- [ ] **Step 5**：REFACTOR — 確認 `render` 的型別轉接最小化（`vnode: unknown` 為對外簽名，內部單點轉為 `render` 入參型別，不擴散 `any`）；確認 `els` 一律回傳陣列。再跑測試確認 PASS。

- [ ] **Step 6**：Commit。
  ```bash
  git add src/client/lib/dom.ts src/client/lib/dom.test.ts
  git commit -m "feat(lib): add typed dom helpers and jsx mount"
  ```

---

### Task 3: `async-ui.ts` — 統一 async UI 狀態（TDD）

`withLoading` 在 `fn` 執行期間禁用 button、顯示 `show`、隱藏 `hide`，並於 `finally` 還原（恢復 button 的 disabled 原值、回復 show/hide 的顯示狀態）。對 `null` 目標安全略過。回傳 `fn` 的結果；`fn` 拋錯時仍正確還原並繼續往上拋。

**Files:**
- Create: `src/client/lib/async-ui.ts`
- Test: `src/client/lib/async-ui.test.ts`

- [ ] **Step 1**：先寫失敗測試 `src/client/lib/async-ui.test.ts`。

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { withLoading } from './async-ui'

function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('withLoading', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('執行期間禁用 button，結束後還原', async () => {
    const button = document.createElement('button')
    document.body.appendChild(button)
    expect(button.disabled).toBe(false)

    let observedDisabled = false
    const result = await withLoading({ button }, async () => {
      observedDisabled = button.disabled
      await tick()
      return 'done'
    })

    expect(observedDisabled).toBe(true)
    expect(button.disabled).toBe(false)
    expect(result).toBe('done')
  })

  it('還原 button 既有的 disabled 原值（原本已 disabled 則維持 disabled）', async () => {
    const button = document.createElement('button')
    button.disabled = true
    document.body.appendChild(button)

    await withLoading({ button }, async () => {
      expect(button.disabled).toBe(true)
    })

    expect(button.disabled).toBe(true)
  })

  it('執行期間顯示 show、隱藏 hide，結束後還原', async () => {
    const spinner = document.createElement('div')
    spinner.classList.add('hidden')
    const label = document.createElement('div')
    document.body.append(spinner, label)

    let spinnerVisibleDuring = false
    let labelHiddenDuring = false
    await withLoading({ show: [spinner], hide: [label] }, async () => {
      spinnerVisibleDuring = !spinner.classList.contains('hidden')
      labelHiddenDuring = label.classList.contains('hidden')
      await tick()
    })

    expect(spinnerVisibleDuring).toBe(true)
    expect(labelHiddenDuring).toBe(true)
    expect(spinner.classList.contains('hidden')).toBe(true)
    expect(label.classList.contains('hidden')).toBe(false)
  })

  it('fn 拋錯時仍還原並向上拋出', async () => {
    const button = document.createElement('button')
    document.body.appendChild(button)

    await expect(
      withLoading({ button }, async () => {
        expect(button.disabled).toBe(true)
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    expect(button.disabled).toBe(false)
  })

  it('對 null 目標安全略過', async () => {
    const result = await withLoading(
      { button: null, show: [null], hide: [null] },
      async () => 42,
    )
    expect(result).toBe(42)
  })
})
```

- [ ] **Step 2**：執行測試，預期 **FAIL**。
  ```bash
  bun run test src/client/lib/async-ui.test.ts
  ```
  預期：失敗（`Cannot find module './async-ui'`）。

- [ ] **Step 3**：寫實作 `src/client/lib/async-ui.ts`。

```ts
export interface LoadingTargets {
  button?: HTMLButtonElement | null
  show?: (HTMLElement | null)[]
  hide?: (HTMLElement | null)[]
}

const HIDDEN_CLASS = 'hidden'

export async function withLoading<T>(targets: LoadingTargets, fn: () => Promise<T>): Promise<T> {
  const { button, show = [], hide = [] } = targets
  const wasDisabled = button?.disabled ?? false
  const wasHidden = show.map(node => node?.classList.contains(HIDDEN_CLASS) ?? false)
  const wasShown = hide.map(node => !(node?.classList.contains(HIDDEN_CLASS) ?? false))

  if (button)
    button.disabled = true
  show.forEach(node => node?.classList.remove(HIDDEN_CLASS))
  hide.forEach(node => node?.classList.add(HIDDEN_CLASS))

  try {
    return await fn()
  }
  finally {
    if (button)
      button.disabled = wasDisabled
    show.forEach((node, i) => node?.classList.toggle(HIDDEN_CLASS, wasHidden[i]))
    hide.forEach((node, i) => node?.classList.toggle(HIDDEN_CLASS, !wasShown[i]))
  }
}
```

- [ ] **Step 4**：執行測試，預期 **PASS**。
  ```bash
  bun run test src/client/lib/async-ui.test.ts
  ```
  預期：全部通過。

- [ ] **Step 5**：REFACTOR — 確認還原邏輯以 `finally` 保證、null 目標無例外、無 `any`、`HIDDEN_CLASS` 常數化避免硬編碼。再跑測試確認 PASS。

- [ ] **Step 6**：Commit。
  ```bash
  git add src/client/lib/async-ui.ts src/client/lib/async-ui.test.ts
  git commit -m "feat(lib): add withLoading async ui state helper"
  ```

---

### Task 4: `store.ts` — 極小狀態容器（TDD）

`createStore` 回傳 `{ get, set, subscribe }`。`set` 接受新值或 `(prev) => next` 更新函式；變更後通知所有 subscriber，傳入新 state。`subscribe` 回傳 unsubscribe 函式。

**Files:**
- Create: `src/client/lib/store.ts`
- Test: `src/client/lib/store.test.ts`

- [ ] **Step 1**：先寫失敗測試 `src/client/lib/store.test.ts`。

```ts
import { describe, expect, it, vi } from 'vitest'
import { createStore } from './store'

describe('createStore', () => {
  it('get 回傳初始值', () => {
    const store = createStore({ count: 0 })
    expect(store.get()).toEqual({ count: 0 })
  })

  it('set 接受新值並更新', () => {
    const store = createStore({ count: 0 })
    store.set({ count: 5 })
    expect(store.get()).toEqual({ count: 5 })
  })

  it('set 接受更新函式並以前一個 state 計算', () => {
    const store = createStore({ count: 1 })
    store.set(prev => ({ count: prev.count + 1 }))
    expect(store.get()).toEqual({ count: 2 })
  })

  it('set 後以新 state 通知 subscriber', () => {
    const store = createStore({ count: 0 })
    const listener = vi.fn()
    store.subscribe(listener)

    store.set({ count: 3 })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ count: 3 })
  })

  it('subscribe 回傳的函式可取消訂閱', () => {
    const store = createStore({ count: 0 })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    unsubscribe()
    store.set({ count: 1 })

    expect(listener).not.toHaveBeenCalled()
  })

  it('支援多個 subscriber', () => {
    const store = createStore(0)
    const a = vi.fn()
    const b = vi.fn()
    store.subscribe(a)
    store.subscribe(b)

    store.set(7)

    expect(a).toHaveBeenCalledWith(7)
    expect(b).toHaveBeenCalledWith(7)
  })
})
```

- [ ] **Step 2**：執行測試，預期 **FAIL**。
  ```bash
  bun run test src/client/lib/store.test.ts
  ```
  預期：失敗（`Cannot find module './store'`）。

- [ ] **Step 3**：寫實作 `src/client/lib/store.ts`。

```ts
export interface Store<T> {
  get: () => T
  set: (next: T | ((prev: T) => T)) => void
  subscribe: (fn: (state: T) => void) => () => void
}

function isUpdater<T>(next: T | ((prev: T) => T)): next is (prev: T) => T {
  return typeof next === 'function'
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial
  const listeners = new Set<(state: T) => void>()

  return {
    get: () => state,
    set: (next) => {
      state = isUpdater(next) ? next(state) : next
      listeners.forEach(listener => listener(state))
    },
    subscribe: (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
}
```

- [ ] **Step 4**：執行測試，預期 **PASS**。
  ```bash
  bun run test src/client/lib/store.test.ts
  ```
  預期：全部通過。

- [ ] **Step 5**：REFACTOR — 確認 `isUpdater` type guard 正確收斂函式型別、`Set` 避免重複 subscriber、unsubscribe 冪等、無 `any`。再跑測試確認 PASS。

- [ ] **Step 6**：Commit。
  ```bash
  git add src/client/lib/store.ts src/client/lib/store.test.ts
  git commit -m "feat(lib): add minimal subscribable store"
  ```

---

### Task 5: `icons.ts` — 單一 lucide 初始化（煙霧測試）

收斂為單一 tree-shaken `createIcons` 策略（沿用 `src/client/icons.ts` 既有的 icon set 與 attrs / nameAttr），對外只暴露 `renderIcons(root?)`。`root` 預設為 `document`，傳入時僅掃描該範圍。**不**暴露 `window.lucide` 全域。因 `createIcons` 為 lucide 內部行為，測試以煙霧/輕量為主：驗證 `renderIcons` 可被呼叫且對 `data-lucide` 節點完成替換（happy-dom 下不拋例外即可）。

**Files:**
- Create: `src/client/lib/icons.ts`
- Test: `src/client/lib/icons.test.ts`

- [ ] **Step 1**：先寫失敗測試 `src/client/lib/icons.test.ts`（煙霧測試）。

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { renderIcons } from './icons'

describe('renderIcons', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('無參數呼叫時不拋例外', () => {
    document.body.innerHTML = '<i data-lucide="settings"></i>'
    expect(() => renderIcons()).not.toThrow()
  })

  it('傳入 root 時僅在該範圍掃描且不拋例外', () => {
    document.body.innerHTML = '<div id="scope"><i data-lucide="search"></i></div>'
    const scope = document.getElementById('scope') as HTMLElement
    expect(() => renderIcons(scope)).not.toThrow()
  })

  it('將 data-lucide 佔位元素替換為 svg', () => {
    document.body.innerHTML = '<i data-lucide="settings"></i>'
    renderIcons(document.body)
    expect(document.body.querySelector('svg')).not.toBeNull()
  })
})
```

- [ ] **Step 2**：執行測試，預期 **FAIL**。
  ```bash
  bun run test src/client/lib/icons.test.ts
  ```
  預期：失敗（`Cannot find module './icons'`）。

- [ ] **Step 3**：寫實作 `src/client/lib/icons.ts`（沿用既有 icon set 與設定，加上可選 `root`）。

```ts
import {
  Archive,
  Check,
  createIcons,
  Edit3,
  Fingerprint,
  Info,
  Key,
  Laptop,
  List,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  SendHorizontal,
  Settings,
  Smartphone,
  Sun,
  Ticket,
  Trash2,
  TriangleAlert,
} from 'lucide'

const icons = {
  LogOut,
  List,
  Settings,
  Sun,
  Moon,
  SendHorizontal,
  Archive,
  Plus,
  Search,
  Menu,
  Check,
  Info,
  Ticket,
  TriangleAlert,
  Fingerprint,
  Edit3,
  Trash2,
  Key,
  Laptop,
  Smartphone,
}

export function renderIcons(root?: ParentNode): void {
  createIcons({
    icons,
    attrs: {
      'stroke-width': 2,
      'class': 'lucide-icon',
    },
    nameAttr: 'data-lucide',
    ...(root ? { root: root as Element | Document | DocumentFragment } : {}),
  })
}
```

- [ ] **Step 4**：執行測試，預期 **PASS**。
  ```bash
  bun run test src/client/lib/icons.test.ts
  ```
  預期：全部通過。若第三個 case 因 happy-dom 與 lucide `createIcons` 的 DOM API 相容性而無法替換 svg，僅保留前兩個「不拋例外」的煙霧 case，並在 commit message body 註明降級原因（spec §7 允許 icons 僅輕量/煙霧測試）。

- [ ] **Step 5**：REFACTOR — 確認 icon set 與 `src/client/icons.ts` 一致、無 `window.lucide` 全域暴露、`root` 為可選且僅在提供時帶入。再跑測試確認 PASS。

- [ ] **Step 6**：Commit。
  ```bash
  git add src/client/lib/icons.ts src/client/lib/icons.test.ts
  git commit -m "feat(lib): add single-strategy lucide renderIcons"
  ```

---

### Task 6: 全層驗證與覆蓋率確認

- [ ] **Step 1**：執行 lib 層全部測試，預期 **PASS**。
  ```bash
  bun run test src/client/lib
  ```

- [ ] **Step 2**：產生覆蓋率，確認 `src/client/lib/` 各模組 ≥ 80% 行覆蓋。
  ```bash
  bun run test:coverage src/client/lib
  ```
  預期：`api` / `dom` / `async-ui` / `store` 行覆蓋 ≥ 80%；`icons` 為煙霧測試，覆蓋率不列入硬性門檻但函式應被執行到。

- [ ] **Step 3**：型別與 lint 檢查，預期無錯誤。
  ```bash
  bun run typecheck && bun run lint src/client/lib
  ```
  預期：無 `any`、無 type error、無 lint error。

- [ ] **Step 4**：若上述任一檢查失敗，回到對應 Task 修正後重跑；全綠後本階段完成（前 5 個 Task 已各自 commit，此步無新增 commit）。

---

## Self-Review

**Spec 覆蓋（對照 §3.1 + §7）**
- §3.1 `api.ts`：`ApiError(message, status)`、`createApi(fetchImpl)`、`api = createApi(globalThis.fetch.bind(globalThis))`、`get/post/put/delete`、envelope 解析（`success === false` 或非 2xx 丟 `ApiError`，否則回 `data`）、`RequestOptions = { method?, body?, signal? }` — 全部落在 Task 1，簽名與 spec 程式碼區塊一致（`readonly status` 採任務指定的 parameter property 形式）。
- §3.1 `dom.ts`：`el` / `elx`（缺失即拋）/ `els` / `mount`（清空後 `hono/jsx/dom` render，接受 element 或 id 字串）— Task 2。
- §3.1 `async-ui.ts`：`withLoading<T>(targets, fn)`，禁用 button + show/hide 切換 + `finally` 還原 — Task 3。
- §3.1 `icons.ts`：`renderIcons(root?)` 單一 lucide 策略 — Task 5（煙霧/輕量，符合 §7「icons 輕量整合」）。
- §3.1 `store.ts`：`Store<T>` 介面 + `createStore<T>` — Task 4。
- §7 測試策略：對 `api`（注入 mock fetch via `vi.fn()`）、`store`、`dom`、`async-ui` 以 happy-dom 做單元測試；每檔 red→green→refactor；覆蓋 ≥ 80%（Task 6 驗證）。`formAdaptor` / `getCurrentHour` / `processSubscriptionReminder` 屬 P2/P6 範圍，不在本計畫。

**Placeholder 掃描**：全文無 `TODO` / `FIXME` / `...` 佔位；每個模組的 test 與 impl 均為完整可執行程式碼；每個 `bun run test` 指令皆標明預期 FAIL 或 PASS；每個 Task 皆有 conventional commit（無 Co-Authored-By trailer）。

**跨模組型別一致性**：
- `api.ts` 對外不洩漏 `any`；`Envelope` 內部型別本地化，泛型 `T` 由呼叫端決定，後續 island 可 `api.get<Subscription[]>('/api/subscriptions')` 直接取代現行 `admin/index.ts` 中 `data.data && Array.isArray(...)` 的防禦式解析。
- `dom.ts` 的 `mount(target, vnode: unknown)` 與 `tableRenderer.tsx` 現行「`innerHTML = ''` 後 `render(vnode, host)`」語意一致，後續可整批替換。
- `async-ui.ts` 的 `LoadingTargets.button?: HTMLButtonElement | null` 與 `dom.el<HTMLButtonElement>(...)`（回傳可空）型別吻合，呼叫端無需額外斷言。
- `store.ts` 的 `set` updater 形式與 `subscribe` unsubscribe 形式，足以取代 `admin/index.ts` 現行的 `subscriptionsCache` + CustomEvent 機制（由後續 island plan 遷移）。
- 全部模組維持 TypeScript strict、**零 `any`**（測試中對 `vi.fn()` 注入 fetch 使用 `as unknown as typeof fetch` 為測試替身的標準窄化，非生產碼 `any`）。
