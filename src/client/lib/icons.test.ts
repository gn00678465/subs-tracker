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
