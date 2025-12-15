import { circularReveal } from './circularReveal'

type Theme = 'light' | 'dark'

interface ThemeToggleState {
  current: Theme
}

const state: ThemeToggleState = {
  current: (localStorage.getItem('theme') as Theme) || 'light',
}

/**
 * 初始化主題 - 從 localStorage 讀取並套用
 * 避免 FOUC (Flash of Unstyled Content)
 */
export function initTheme(): void {
  const savedTheme = (localStorage.getItem('theme') as Theme) || 'light'
  document.documentElement.setAttribute('data-theme', savedTheme)
  state.current = savedTheme

  // 設定 checkbox 狀態（如果元素存在）
  const toggle = document.getElementById('theme-toggle') as HTMLInputElement | null
  if (toggle) {
    toggle.checked = state.current === 'dark'
  }
}

/**
 * 切換主題並觸發圓形展開動畫
 * @param event 點擊事件（用於取得座標）
 */
function toggleTheme(event: Event): void {
  const toggle = document.getElementById('theme-toggle') as HTMLInputElement | null
  if (!toggle)
    return

  const newTheme: Theme = toggle.checked ? 'dark' : 'light'

  circularReveal(event, {
    toggle: () => {
      state.current = newTheme
      document.documentElement.setAttribute('data-theme', newTheme)
      localStorage.setItem('theme', newTheme)
    },
    getCurrent: () => newTheme === 'dark',
    duration: 500,
    easing: 'ease-in-out',
  })
}

/**
 * 設定主題切換事件監聽器
 */
export function setupThemeToggle(): void {
  const toggle = document.getElementById('theme-toggle') as HTMLInputElement | null
  if (!toggle)
    return

  // 關鍵：監聽 label 的 click 事件（而非 checkbox 的 change 事件）
  // 因為 change 事件沒有滑鼠座標，而 circularReveal 需要座標來計算動畫原點
  const label = toggle.closest('label')
  if (!label)
    return

  label.addEventListener('click', (event) => {
    // 阻止預設行為，手動控制 checkbox 狀態
    event.preventDefault()

    // 切換 checkbox
    toggle.checked = !toggle.checked

    // 觸發主題切換與動畫
    toggleTheme(event)
  })
}

/**
 * 自動初始化 - 當 DOM 準備好時執行
 */
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initTheme()
      setupThemeToggle()
    })
  }
  else {
    initTheme()
    setupThemeToggle()
  }
}
