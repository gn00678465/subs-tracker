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
