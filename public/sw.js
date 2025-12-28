// SubsTracker Service Worker - Optimized Version
const CACHE_VERSION = 'v1'
const CACHE_NAME = `subsTracker-${CACHE_VERSION}`
const PAGES_CACHE = `pages-${CACHE_VERSION}`
const STATIC_CACHE = `static-${CACHE_VERSION}`
const IMAGE_CACHE = `images-${CACHE_VERSION}`
const CDN_CACHE = `cdn-${CACHE_VERSION}`

// Cache expiry constants (moved from magic numbers)
const CACHE_MAX_AGE = {
  PAGES: 86400000, // 24小時 (24 * 60 * 60 * 1000)
  STATIC: 2592000000, // 30天 (30 * 24 * 60 * 60 * 1000)
  IMAGES: 2592000000, // 30天
  CDN: 604800000, // 7天 (7 * 24 * 60 * 60 * 1000)
  DEFAULT: 86400000, // 24小時
}

// Timeout constants
const NETWORK_TIMEOUT = {
  PAGES: 5000, // 5秒
  DEFAULT: 3000, // 3秒
}

// Cache size limits (防止無限增長)
const CACHE_LIMITS = {
  PAGES: 50,
  STATIC: 100,
  IMAGES: 200,
  CDN: 20,
}

// 需要預快取的關鍵資源
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.svg',
]

// 安裝事件 - 預快取資源
globalThis.addEventListener('install', (event) => {
  console.log('[SW] Installing...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching resources')
      return cache.addAll(PRECACHE_URLS)
    }).then(() => {
      console.log('[SW] Skip waiting')
      return globalThis.skipWaiting()
    }).catch((error) => {
      // IMPROVEMENT: Added error handling for precaching failures
      console.error('[SW] Precaching failed:', error)
      throw error
    }),
  )
})

// 啟動事件 - 清理舊快取
globalThis.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName.includes('subsTracker-') && cacheName !== CACHE_NAME
            && cacheName !== PAGES_CACHE && cacheName !== STATIC_CACHE
            && cacheName !== IMAGE_CACHE && cacheName !== CDN_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
          return null
        }),
      )
    }).then(() => {
      console.log('[SW] Claiming clients')
      return globalThis.clients.claim()
    }).catch((error) => {
      // IMPROVEMENT: Added error handling
      console.error('[SW] Activation failed:', error)
    }),
  )
})

// Fetch 事件 - 快取策略
globalThis.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // IMPROVEMENT: Scope limiting - 只處理同源請求
  if (url.origin !== globalThis.location.origin && !url.hostname.includes('unpkg.com')) {
    return
  }

  // 跳過非 GET 請求
  if (request.method !== 'GET') {
    return
  }

  // API 請求 - Network Only（永不快取）
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request))
    return
  }

  // 頁面路由 - Network First（優先網路，5秒超時）
  if (url.pathname === '/' || url.pathname.startsWith('/admin')) {
    event.respondWith(
      networkFirst(request, PAGES_CACHE, NETWORK_TIMEOUT.PAGES, CACHE_MAX_AGE.PAGES, CACHE_LIMITS.PAGES),
    )
    return
  }

  // JS/CSS - Cache First
  if (request.destination === 'script' || request.destination === 'style'
    || url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      cacheFirst(request, STATIC_CACHE, CACHE_MAX_AGE.STATIC, CACHE_LIMITS.STATIC),
    )
    return
  }

  // 圖片 - Cache First
  if (request.destination === 'image'
    || url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp)$/)) {
    event.respondWith(
      cacheFirst(request, IMAGE_CACHE, CACHE_MAX_AGE.IMAGES, CACHE_LIMITS.IMAGES),
    )
    return
  }

  // htmx CDN - Stale While Revalidate
  if (url.hostname === 'unpkg.com' && url.pathname.includes('htmx.org')) {
    event.respondWith(
      staleWhileRevalidate(request, CDN_CACHE, CACHE_MAX_AGE.CDN, CACHE_LIMITS.CDN),
    )
    return
  }

  // 其他請求 - Network First
  event.respondWith(
    networkFirst(request, CACHE_NAME, NETWORK_TIMEOUT.DEFAULT, CACHE_MAX_AGE.DEFAULT),
  )
})

// Helper: 清理舊快取項目以維持限制
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()

  if (keys.length > maxItems) {
    // 刪除最舊的項目
    const itemsToDelete = keys.slice(0, keys.length - maxItems)
    await Promise.all(itemsToDelete.map(key => cache.delete(key)))
    console.log(`[SW] Trimmed ${itemsToDelete.length} items from ${cacheName}`)
  }
}

// Helper: 使用 metadata 儲存快取時間戳
async function putWithMetadata(cache, request, response) {
  // IMPROVEMENT: 使用 metadata 而非 Date header 來追蹤快取時間
  const metadata = {
    cachedAt: Date.now(),
    url: request.url,
  }

  // Clone response and add custom header with metadata
  const headers = new Headers(response.headers)
  headers.set('X-SW-Cache-Time', metadata.cachedAt.toString())

  const modifiedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })

  await cache.put(request, modifiedResponse)
}

// Helper: 檢查快取是否過期（使用 metadata）
function isCacheExpired(cachedResponse, maxAge) {
  const cacheTime = cachedResponse.headers.get('X-SW-Cache-Time')

  if (!cacheTime) {
    // 如果沒有 metadata，fallback 到 Date header
    const cachedDate = new Date(cachedResponse.headers.get('date'))
    return Date.now() - cachedDate.getTime() >= maxAge
  }

  // IMPROVEMENT: 快速的時間戳比較，無需 Date 解析
  return Date.now() - Number.parseInt(cacheTime, 10) >= maxAge
}

// Network First 策略 - 優化版
async function networkFirst(request, cacheName, timeout, maxAge, cacheLimit) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const networkResponse = await fetch(request, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    // IMPROVEMENT: 驗證 response 狀態碼，防止快取錯誤響應
    if (networkResponse.ok && networkResponse.status === 200) {
      // IMPROVEMENT: 非阻塞快取更新
      const cache = await caches.open(cacheName)
      putWithMetadata(cache, request, networkResponse.clone())
        .then(() => cacheLimit && trimCache(cacheName, cacheLimit))
        .catch(err => console.warn('[SW] Cache update failed:', err))
    }

    return networkResponse
  }
  catch (error) {
    console.log('[SW] Network failed, trying cache:', error.message)
    const cachedResponse = await caches.match(request)

    if (cachedResponse) {
      // IMPROVEMENT: 使用優化的過期檢查
      if (!isCacheExpired(cachedResponse, maxAge)) {
        console.log('[SW] Serving from cache:', request.url)
        return cachedResponse
      }
      console.log('[SW] Cache expired for:', request.url)
    }

    // IMPROVEMENT: 更詳細的錯誤日誌
    console.error('[SW] Failed to serve:', request.url, error)
    throw error
  }
}

// Cache First 策略 - 優化版
async function cacheFirst(request, cacheName, maxAge, cacheLimit) {
  try {
    const cachedResponse = await caches.match(request)

    if (cachedResponse) {
      // IMPROVEMENT: 使用優化的過期檢查
      if (!isCacheExpired(cachedResponse, maxAge)) {
        console.log('[SW] Cache hit:', request.url)
        return cachedResponse
      }
      console.log('[SW] Cache expired, fetching:', request.url)
    }

    const networkResponse = await fetch(request)

    // IMPROVEMENT: 驗證 response 狀態碼
    if (networkResponse.ok && networkResponse.status === 200) {
      const cache = await caches.open(cacheName)
      await putWithMetadata(cache, request, networkResponse.clone())

      // IMPROVEMENT: 清理舊快取
      if (cacheLimit) {
        trimCache(cacheName, cacheLimit).catch(err =>
          console.warn('[SW] Cache trimming failed:', err),
        )
      }
    }

    return networkResponse
  }
  catch (error) {
    // IMPROVEMENT: 錯誤處理
    console.error('[SW] Cache First failed for:', request.url, error)
    throw error
  }
}

// Stale While Revalidate 策略 - 優化版
async function staleWhileRevalidate(request, cacheName, maxAge, cacheLimit) {
  const cachedResponse = await caches.match(request)

  // IMPROVEMENT: 添加錯誤處理的非阻塞更新
  const fetchPromise = fetch(request).then(async (networkResponse) => {
    // IMPROVEMENT: 驗證 response 狀態碼
    if (networkResponse.ok && networkResponse.status === 200) {
      try {
        const cache = await caches.open(cacheName)
        await putWithMetadata(cache, request, networkResponse.clone())

        // IMPROVEMENT: 清理舊快取
        if (cacheLimit) {
          trimCache(cacheName, cacheLimit).catch(err =>
            console.warn('[SW] Cache trimming failed:', err),
          )
        }
      }
      catch (error) {
        console.warn('[SW] Background cache update failed:', error)
      }
    }
    return networkResponse
  }).catch((error) => {
    // IMPROVEMENT: 網路失敗時的錯誤處理
    console.warn('[SW] Background fetch failed:', error)
    return cachedResponse // 返回快取的響應
  })

  // 如果有快取且未過期，立即返回；否則等待網路響應
  if (cachedResponse && !isCacheExpired(cachedResponse, maxAge)) {
    console.log('[SW] Serving stale cache:', request.url)
    return cachedResponse
  }

  return fetchPromise
}
