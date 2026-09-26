// 離線時顯示最後一次取得的資料（docs/design/screens.md「離線」）。
// 改變快取內容的格式時，改 CACHE 的版本；舊版本的快取在 activate 時刪除。
const CACHE = 'subs-tracker-v2'
const PRECACHE = ['/manifest.webmanifest', '/favicon.svg', '/icon.svg', '/icon-192.png', '/apple-touch-icon.png']
const PAGES = new Set(['/', '/admin', '/admin/config'])
// 頁面依這兩個回應的 X-Cached-At 判斷是否離線；GET /api/settings 含通知管道的憑證，登出時刪除
const API_DATA = new Set(['/api/subscriptions', '/api/settings'])
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com'])

globalThis.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => globalThis.skipWaiting()),
  )
})

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => globalThis.clients.claim()),
  )
})

globalThis.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (FONT_HOSTS.has(url.hostname)) return event.respondWith(cacheFirst(request))
  if (url.origin !== globalThis.location.origin) return

  if (url.pathname === '/api/logout') return event.respondWith(forgetApiData().then(() => fetch(request)))
  if (API_DATA.has(url.pathname)) return event.respondWith(networkFirst(request, true))
  if (url.pathname.startsWith('/api/')) return
  if (PAGES.has(url.pathname)) return event.respondWith(networkFirst(request, false))
  event.respondWith(cacheFirst(request))
})

async function networkFirst(request, stamp) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) {
      const copy = response.clone()
      const headers = new Headers(copy.headers)
      if (stamp) headers.set('X-Cached-At', new Date().toISOString())
      await cache.put(request, new Response(await copy.blob(), { status: copy.status, headers }))
    }
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw error
  }
}

// 檔名含雜湊的建置檔、圖示與字型不會變，有快取就不連網路
async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  // 跨網域的字型樣式表是 opaque 回應，status 為 0
  if (response.ok || response.type === 'opaque') await cache.put(request, response.clone())
  return response
}

async function forgetApiData() {
  const cache = await caches.open(CACHE)
  await Promise.all([...API_DATA].map((path) => cache.delete(path)))
}
