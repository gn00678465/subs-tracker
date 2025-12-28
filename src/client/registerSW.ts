// Service Worker 註冊腳本
// 只在生產環境且支援 Service Worker 的瀏覽器中註冊

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })

      console.log('[PWA] Service Worker registered:', registration.scope)

      // 監聽更新
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] New content available, please refresh.')
              // 可選：顯示更新提示給使用者
              // showUpdateNotification();
            }
          })
        }
      })

      // 檢查更新（每小時）
      setInterval(() => {
        registration.update()
      }, 60 * 60 * 1000)
    }
    catch (error) {
      console.error('[PWA] Service Worker registration failed:', error)
    }
  })
}
