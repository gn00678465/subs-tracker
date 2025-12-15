import * as logger from '../utils/logger'

interface StateTransitionConfig {
  /** 切換狀態的回調函式 */
  toggle: () => void
  /** 獲取當前狀態的函式 */
  getCurrent: () => boolean
  /** 動畫持續時間（毫秒），預設 500 */
  duration?: number
  /** 緩動函式，預設 'ease-in-out' */
  easing?: string
}

/**
 * 圓形展開效果轉場
 * @param e 觸發事件（通常是點擊事件）
 * @param config 轉場配置
 */
export async function circularReveal(e: Event, config: StateTransitionConfig): Promise<void> {
  // 檢查瀏覽器是否支援 View Transition API 和使用者偏好設定

  const isAppearanceTransition
    = !!document.startViewTransition
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!isAppearanceTransition || !document.startViewTransition) {
    // 不支援時直接切換狀態
    config.toggle()
    return
  }

  try {
    // 開始 View Transition
    const transition = document.startViewTransition(() => {
      config.toggle()
    })

    // 等待快照準備就緒後執行圓形展開動畫
    await transition.ready

    const isCurrentState = config.getCurrent()
    const target = e.target as HTMLElement
    const rect = target.getBoundingClientRect()
    // 計算點擊位置（相對於按鈕中心）
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    // 計算到畫面邊緣的最大距離作為展開半徑
    const endRadius = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y),
    )

    // 轉換為百分比座標和半徑
    const ratioX = (100 * x) / innerWidth
    const ratioY = (100 * y) / innerHeight
    const referR = Math.hypot(innerWidth, innerHeight) / Math.SQRT2
    const ratioR = (100 * endRadius) / referR

    // 定義圓形 clip-path 動畫路徑
    const clipPath = [
      `circle(0% at ${ratioX}% ${ratioY}%)`,
      `circle(${ratioR}% at ${ratioX}% ${ratioY}%)`,
    ]

    // 執行動畫，根據當前狀態決定動畫方向和目標偽元素
    document.documentElement.animate(
      {
        clipPath: isCurrentState ? [...clipPath].reverse() : clipPath,
      },
      {
        duration: config.duration || 500,
        easing: config.easing || 'ease-in-out',
        fill: 'both',
        pseudoElement: isCurrentState
          ? '::view-transition-old(root)'
          : '::view-transition-new(root)',
      },
    )
  }
  catch (error) {
    // 如果 transition 失敗，至少確保切換成功
    config.toggle()
    logger.error('ViewTransition 錯誤:', error)
  }
}
