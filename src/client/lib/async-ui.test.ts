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
    document.body.appendChild(spinner)
    document.body.appendChild(label)

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
