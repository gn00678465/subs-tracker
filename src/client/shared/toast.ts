let timer: ReturnType<typeof setTimeout> | undefined

/** 操作結果寫出做了什麼，例如「已儲存 Netflix」 */
export function toast(text: string) {
  document.querySelector('.toast')?.remove()
  const element = document.createElement('div')
  element.className = 'toast'
  element.setAttribute('role', 'status')
  element.textContent = text
  document.body.appendChild(element)
  clearTimeout(timer)
  timer = setTimeout(() => element.remove(), 2600)
}
