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
