/**
 * Toast notification utility
 * Provides DaisyUI-compatible toast notifications
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastOptions {
  message: string
  type?: ToastType
  duration?: number // milliseconds, default 3000
}

let toastContainer: HTMLElement | null = null
let toastAlert: HTMLElement | null = null
let toastMessage: HTMLElement | null = null

/**
 * Initialize toast container (call once on page load)
 */
export function initToastContainer(): void {
  if (toastContainer)
    return // Already initialized

  // Create toast container
  toastContainer = document.createElement('div')
  toastContainer.id = 'toast'
  toastContainer.className = 'toast toast-top toast-end hidden z-50'

  toastAlert = document.createElement('div')
  toastAlert.id = 'toastAlert'
  toastAlert.className = 'alert shadow-lg'

  toastMessage = document.createElement('span')
  toastMessage.id = 'toastMessage'

  toastAlert.appendChild(toastMessage)
  toastContainer.appendChild(toastAlert)
  document.body.appendChild(toastContainer)
}

/**
 * Show toast notification
 */
export function showToast(message: string, type?: ToastType): void
export function showToast(options: ToastOptions): void
export function showToast(
  messageOrOptions: string | ToastOptions,
  type: ToastType = 'success',
): void {
  // Ensure container exists
  if (!toastContainer)
    initToastContainer()

  const message = typeof messageOrOptions === 'string'
    ? messageOrOptions
    : messageOrOptions.message
  const toastType = typeof messageOrOptions === 'string'
    ? type
    : (messageOrOptions.type || 'success')
  const duration = typeof messageOrOptions === 'object'
    ? (messageOrOptions.duration || 3000)
    : 3000

  // Update toast content
  toastAlert!.className = `alert shadow-lg alert-${toastType}`
  toastMessage!.textContent = message
  toastContainer!.classList.remove('hidden')

  // Auto-hide after duration
  setTimeout(() => {
    toastContainer!.classList.add('hidden')
  }, duration)
}

/**
 * Cleanup toast container (optional, for unmounting)
 */
export function destroyToast(): void {
  if (toastContainer && toastContainer.parentNode)
    toastContainer.parentNode.removeChild(toastContainer)

  toastContainer = null
  toastAlert = null
  toastMessage = null
}

// Make globally accessible for inline scripts
declare global {
  interface Window {
    showToast: typeof showToast
    initToastContainer: typeof initToastContainer
  }
}

if (typeof window !== 'undefined') {
  window.showToast = showToast
  window.initToastContainer = initToastContainer
}
