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
