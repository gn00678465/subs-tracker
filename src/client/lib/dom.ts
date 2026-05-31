/** @jsxImportSource hono/jsx/dom */
import { render } from 'hono/jsx/dom'

// 泛型不上界至 HTMLElement：本專案的型別環境（@types/bun + @cloudflare/workers-types
// 與 DOM lib 併用）會讓部分元素型別（如 HTMLSelectElement）無法滿足 `extends HTMLElement`
// 約束，故由呼叫端以泛型參數宣告預期型別，預設為 HTMLElement。
export function el<T = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null
}

export function elx<T = HTMLElement>(id: string): T {
  const found = document.getElementById(id)
  if (!found)
    throw new Error(`Element not found: #${id}`)
  return found as T
}

export function els<T = HTMLElement>(selector: string): T[] {
  return Array.from(document.querySelectorAll(selector)) as T[]
}

export function mount(target: HTMLElement | string, vnode: unknown): void {
  const host = typeof target === 'string' ? elx(target) : target
  host.innerHTML = ''
  render(vnode as Parameters<typeof render>[0], host)
}
