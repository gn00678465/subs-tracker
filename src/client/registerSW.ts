// 開發時不註冊：service worker 的快取會蓋過 Vite 的熱更新
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined)
}
