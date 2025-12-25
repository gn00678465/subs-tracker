/**
 * Toast notification utility (Singleton)
 * Provides DaisyUI-compatible toast notifications with class-based API
 */
import {
  CircleCheckBig,
  CircleQuestionMark,
  CircleX,
  createElement,
  Info,
  TriangleAlert,
} from 'lucide'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastOptions {
  duration?: number // 毫秒，預設 3000
  position?: 'top-start' | 'top-center' | 'top-end' | 'bottom-start' | 'bottom-center' | 'bottom-end'
  className?: string // 額外的 CSS 類別
}

class Toast {
  private static instance: Toast | null = null
  private container: HTMLElement | null = null
  private alert: HTMLElement | null = null
  private message: HTMLElement | null = null
  private hideTimeout: NodeJS.Timeout | null = null
  private readonly defaultPosition: ToastOptions['position'] = 'bottom-end'
  private readonly defaultDuration: number = 3000
  private showIcon: boolean = true

  private constructor() {
    // 延遲初始化，直到首次調用
  }

  /**
   * 獲取 Toast 單例實例
   */
  public static getInstance(): Toast {
    if (!Toast.instance) {
      Toast.instance = new Toast()
    }
    return Toast.instance
  }

  /**
   * 初始化 Toast 容器（懶加載）
   */
  private initialize(): void {
    if (typeof window === 'undefined' || this.container) {
      return
    }

    // 創建容器
    this.container = document.createElement('div')
    this.container.id = 'toast-container'
    this.container.classList.add('toast', 'hidden', 'z-50')

    this.alert = document.createElement('div')
    this.alert.classList.add('alert', 'shadow-lg')

    this.message = document.createElement('span')

    this.alert.appendChild(this.message)
    this.container.appendChild(this.alert)
    document.body.appendChild(this.container)
  }

  /**
   * 添加圖示到 Toast
   * @param parent
   * @param type
   */
  private appendIcon(type: ToastType): SVGElement {
    let icon: SVGElement
    switch (type) {
      case 'success':
        icon = createElement(CircleCheckBig)
        break
      case 'error':
        icon = createElement(CircleX)
        break
      case 'warning':
        icon = createElement(TriangleAlert)
        break
      case 'info':
        icon = createElement(Info)
        break
      default:
        icon = createElement(CircleQuestionMark)
    }

    icon.classList.add('size-5', 'shrink-0')

    return icon
  }

  /**
   * 通用顯示方法
   */
  public show(message: string, type: ToastType = 'info', options?: ToastOptions): void {
    this.initialize() // 確保已初始化

    if (!this.container || !this.alert || !this.message) {
      console.error('[Toast] Container not initialized')
      return
    }

    const duration = options?.duration ?? this.defaultDuration
    const position = options?.position ?? this.defaultPosition

    // 清除之前的自動隱藏定時器
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
      this.hideTimeout = null
    }

    // 更新位置類別
    this.updatePosition(position)

    // 更新樣式和內容
    this.alert.className = `alert shadow-lg alert-${type} ${options?.className ? ` ${options.className}` : ''}`

    // 清空 alert 內容並重新構建（包含圖示）
    this.alert.innerHTML = ''

    // 添加圖示（如果啟用）
    if (this.showIcon) {
      const icon = this.appendIcon(type)
      this.alert.appendChild(icon)
    }

    // 添加訊息文字
    this.alert.appendChild(this.message)
    this.message.textContent = message
    this.container.classList.remove('hidden')

    // 設置自動隱藏
    if (duration > 0) {
      this.hideTimeout = setTimeout(() => {
        this.hide()
      }, duration)
    }
  }

  /**
   * 成功提示
   */
  public success(message: string, options?: ToastOptions): void {
    this.show(message, 'success', options)
  }

  /**
   * 錯誤提示
   */
  public error(message: string, options?: ToastOptions): void {
    this.show(message, 'error', options)
  }

  /**
   * 警告提示
   */
  public warning(message: string, options?: ToastOptions): void {
    this.show(message, 'warning', options)
  }

  /**
   * 資訊提示
   */
  public info(message: string, options?: ToastOptions): void {
    this.show(message, 'info', options)
  }

  /**
   * 手動隱藏 Toast
   */
  public hide(): void {
    if (this.container) {
      this.container.classList.add('hidden')
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
      this.hideTimeout = null
    }
  }

  /**
   * 更新容器位置
   */
  private updatePosition(position: ToastOptions['position']): void {
    if (!this.container || !position)
      return

    // 移除所有位置類別
    this.container.classList.remove(
      'toast-top',
      'toast-bottom',
      'toast-start',
      'toast-center',
      'toast-end',
    )

    // 添加新位置類別
    const [vertical, horizontal] = position.split('-') as ['top' | 'bottom', 'start' | 'center' | 'end']
    this.container.classList.add(`toast-${vertical}`, `toast-${horizontal}`)
  }

  /**
   * 銷毀 Toast 實例（用於清理）
   */
  public destroy(): void {
    this.hide()
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container)
    }
    this.container = null
    this.alert = null
    this.message = null
    Toast.instance = null
  }
}

// 導出單例實例
export const toast = Toast.getInstance()
