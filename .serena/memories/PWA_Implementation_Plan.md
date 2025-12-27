# SubsTracker PWA 實施計劃 - 使用 vite-plugin-pwa

## 概述

為 SubsTracker 新增 PWA 可安裝功能，並替換為綠色主題色（#36A45D）。**使用 vite-plugin-pwa 實現**（替代原手動配置方案）。

## 技術背景

- **執行環境**: Cloudflare Workers
- **套件管理器**: Bun
- **建置工具**: Vite 6.3.5
- **目前插件**: cloudflare、ssrPlugin、tailwindcss
- **樣式框架**: Tailwind CSS 4.x + DaisyUI
- **JSX 執行時**: Hono JSX（非 React）

## 實施步驟

### 階段 1: 依賴安裝

```bash
bun add -D vite-plugin-pwa@^0.21.3 workbox-window
```

**版本說明**:
- `vite-plugin-pwa@^0.21.3`: 支援 Vite 6.x 的最新穩定版
- `workbox-window`: 客戶端 Service Worker 註冊函式庫

### 階段 2: Icon 資源準備

**需要使用者提供**: 綠色 SVG icon (#36A45D)

#### 產生方法（三選一）

**方法 1: ImageMagick (macOS 推薦)**
```bash
# 安裝
brew install imagemagick

# 產生
convert public/icon.svg -resize 192x192 public/icon-192.png
convert public/icon.svg -resize 512x512 public/icon-512.png
convert public/icon.svg -resize 32x32 public/favicon.svg
convert public/icon.svg -resize 180x180 public/apple-touch-icon.png
```

**方法 2: 線上工具（最簡單）**
- 訪問 https://realfavicongenerator.net/
- 上傳 SVG，下載產生的檔案包
- 解壓到 `/public` 目錄

**方法 3: @vite-pwa/assets-generator（自動化）**
```bash
bunx @vite-pwa/assets-generator
```

#### 目錄結構

```
/public/
├── icon.svg              # 原始綠色 SVG (#36A45D)
├── icon-192.png          # 192x192 PWA icon
├── icon-512.png          # 512x512 PWA icon
├── favicon.svg           # 32x32（替換現有）
└── apple-touch-icon.png  # 180x180 iOS icon
```

#### SVG 要求

確保 SVG 包含正確的綠色填充：
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path fill="#36A45D" d="..."/>
</svg>
```

### 階段 3: Vite 配置修改

**檔案**: `vite.config.ts`

#### 3.1 新增匯入

```typescript
import { VitePWA } from 'vite-plugin-pwa'
```

#### 3.2 修改 plugins 陣列

**⚠️ 插件順序很重要**:

```typescript
export default defineConfig({
  plugins: [
    cloudflare(),      // 1. 必須第一（處理 Workers 建置）
    ssrPlugin(),       // 2. SSR 處理
    VitePWA({          // 3. PWA 配置
      registerType: 'autoUpdate',
      injectRegister: 'auto',

      // Manifest 配置
      manifest: {
        name: 'SubsTracker',
        short_name: 'SubsTracker',
        description: '訂閱管理系統',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#36A45D',       // 綠色主題
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        categories: ['productivity', 'utilities'],
        lang: 'zh-TW'
      },

      // Workbox Service Worker 配置
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],

        // 執行時快取策略
        runtimeCaching: [
          // 1. 頁面路由 - Network First
          {
            urlPattern: /^\/$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 86400  // 24 小時
              },
              networkTimeoutSeconds: 5
            }
          },
          {
            urlPattern: /^\/admin/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 86400
              },
              networkTimeoutSeconds: 5
            }
          },

          // 2. API 路由 - Network Only（永不快取）
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly'
          },

          // 3. 靜態資源 - Cache First
          {
            urlPattern: /\.(?:js|css)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 2592000  // 30 天
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 2592000
              }
            }
          },

          // 4. htmx CDN - Stale While Revalidate
          {
            urlPattern: /^https:\/\/unpkg\.com\/htmx\.org/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'cdn-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 604800  // 7 天
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],

        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: null  // 停用（SSR 應用）
      },

      // 開發環境選項
      devOptions: {
        enabled: false,  // 開發時停用（避免干擾 HMR）
        type: 'module'
      }
    }),
    tailwindcss()      // 4. CSS 處理最後
  ],
  // ... 其他配置
})
```

#### 快取策略說明

| 路由類型 | 策略 | 原因 |
|---------|------|------|
| `/`, `/admin/*` | **Network First**（5s 超時） | 優先取得最新內容，保持認證狀態同步。超時後使用快取（離線存取）。 |
| `/api/*` | **Network Only** | API 資料包含使用者敏感資訊和 JWT 認證，永不快取。 |
| JS/CSS | **Cache First** | 建置產物有 hash，版本不變時優先使用快取，提升效能。 |
| 圖片 | **Cache First** | 靜態資源，長期快取。 |
| htmx CDN | **Stale While Revalidate** | 快速回應 + 背景更新，平衡效能和新鮮度。 |

### 階段 4: TypeScript 類型定義

#### 4.1 修改 `tsconfig.json`

在 `compilerOptions.types` 陣列中新增：
```json
{
  "compilerOptions": {
    "types": [
      "vite/client",
      "@cloudflare/workers-types/2023-07-01",
      "@types/bun",
      "typed-htmx",
      "vite-plugin-pwa/client"  // 新增
    ]
  }
}
```

#### 4.2 建立 `src/vite-env.d.ts`（如不存在）

```typescript
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

### 階段 5: 主題色自訂

**檔案**: `src/style.css`

#### 方案 1: 使用 @theme 指令（Tailwind CSS 4.x）

在 `@import "tailwindcss";` 和 `@plugin "daisyui";` **之間**新增：

```css
@import "tailwindcss";

@theme {
  --color-primary: #36A45D;
  --color-primary-content: #ffffff;
}

@plugin "daisyui";

/* 其餘保持不變（View Transition CSS） */
```

**⚠️ 關鍵**: `@theme` 必須在 `@plugin "daisyui"` **之前**

#### 方案 2: 備用方案（如果 @theme 不生效）

使用 DaisyUI 的 CSS 變數（HSL 格式）：

```css
@import "tailwindcss";
@plugin "daisyui";

:root {
  --p: 151 61% 43%;  /* #36A45D 的 HSL */
  --pc: 0 0% 100%;   /* White */
}

[data-theme="light"] {
  --p: 151 61% 43%;
  --pc: 0 0% 100%;
}

[data-theme="dark"] {
  --p: 151 55% 38%;  /* 深色模式稍微調暗 */
  --pc: 0 0% 100%;
}
```

**HSL 轉換**: `#36A45D` = `hsl(151, 61%, 43%)`

### 階段 6: Layout 元件修改

**檔案**: `src/components/Layout.tsx`

在第 20 行（`<title>{title}</title>` 之後）新增 PWA meta tags：

```tsx
<title>{title}</title>

{/* PWA Meta Tags */}
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#36A45D" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />

{/* iOS Meta Tags */}
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="SubsTracker" />

<ViteClient />
```

**注意**:
- vite-plugin-pwa 產生的檔案名是 `manifest.webmanifest`（不是 `manifest.json`）
- 不需要手動新增 Service Worker 註冊腳本（插件自動處理）
- favicon 使用 SVG 格式，type 為 `image/svg+xml`

### 階段 7: Navbar Logo 替換

**檔案**: `src/components/Navbar.tsx`

替換第 25-37 行的內聯 SVG：

**原程式碼**:
```tsx
<svg
  class="w-8 h-8 text-primary"
  fill="none"
  stroke="currentColor"
  viewBox="0 0 24 24"
>
  <path
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
  />
</svg>
```

**替換為**:
```tsx
<img
  src="/icon.svg"
  alt="SubsTracker Logo"
  class="w-8 h-8"
/>
```

### 階段 8: Login 頁面 Logo 新增

**檔案**: `src/pages/Login.tsx`

在第 14-17 行標題區域修改：

**原程式碼**:
```tsx
<div class="text-center mb-6">
  <h1 class="text-3xl font-bold text-base-content">SubsTracker</h1>
  <p class="text-base-content/70 mt-2">登入管理您的訂閱提醒</p>
</div>
```

**替換為**:
```tsx
<div class="text-center mb-6">
  <div class="flex justify-center mb-4">
    <img
      src="/icon.svg"
      alt="SubsTracker Logo"
      class="w-16 h-16"
    />
  </div>
  <h1 class="text-3xl font-bold text-base-content">SubsTracker</h1>
  <p class="text-base-content/70 mt-2">登入管理您的訂閱提醒</p>
</div>
```

## 測試驗證

### 本地建置測試

```bash
# 建置
bun run build

# 檢查產物
ls -la dist/
# 應包含：
# - manifest.webmanifest
# - sw.js
# - workbox-*.js
# - icon-192.png
# - icon-512.png

# 預覽
bun run preview
```

### PWA 檢查清單

**DevTools 驗證**:
- [ ] Application → Manifest
  - `theme_color`: #36A45D
  - 圖示顯示綠色
  - 所有欄位正確
- [ ] Application → Service Workers
  - 狀態: Activated and running
  - Scope: /
- [ ] Network 面板
  - 重新整理頁面，部分資源顯示「(ServiceWorker)」

**頁面驗證**:
- [ ] 瀏覽器分頁顯示綠色 favicon
- [ ] Navbar logo 顯示綠色 SVG
- [ ] Login 頁面顯示綠色 logo
- [ ] 所有 primary 按鈕為綠色（#36A45D）

**安裝驗證**:
- [ ] Chrome 網址列出現「安裝」圖示
- [ ] 點擊安裝，獨立視窗啟動
- [ ] Standalone 模式（無瀏覽器 UI）

### Lighthouse PWA 稽核

```bash
# 在預覽時
bun run preview

# Chrome DevTools → Lighthouse
# 選擇「Progressive Web App」
# 執行稽核
```

**目標分數**: ≥ 90

**常見問題**:
- "Does not register a service worker" → 檢查 SW 註冊
- "Web app manifest does not meet installability" → 檢查 manifest 欄位
- "No matching service worker detected" → 清除快取重試

### 行動裝置測試

**iOS Safari**:
1. Safari → 分享 → 加入主畫面
2. 驗證主畫面圖示為綠色（180x180）
3. 啟動驗證 standalone 模式

**Android Chrome**:
1. Chrome → 選單 → 安裝應用程式
2. 驗證安裝橫幅顯示
3. 啟動驗證 splash screen 和圖示

### 部署驗證

```bash
bun run deploy

# 驗證 PWA 資源可存取
curl https://your-worker.workers.dev/manifest.webmanifest
curl https://your-worker.workers.dev/sw.js
curl https://your-worker.workers.dev/icon-192.png
```

## 檔案修改清單

### 需要修改的檔案（6 個）

1. `vite.config.ts` - 新增 VitePWA 插件配置
2. `tsconfig.json` - 新增 `vite-plugin-pwa/client` 類型
3. `src/style.css` - 新增 `@theme` 定義 primary 色
4. `src/components/Layout.tsx` - 新增 PWA meta tags
5. `src/components/Navbar.tsx` - 替換 logo（SVG → `<img>`）
6. `src/pages/Login.tsx` - 新增 logo

### 需要建立的檔案（5 個）

1. `public/icon.svg` - 使用者提供的綠色 SVG
2. `public/icon-192.png` - 產生
3. `public/icon-512.png` - 產生
4. `public/apple-touch-icon.png` - 產生
5. `src/vite-env.d.ts` - PWA 類型定義（如不存在）

### 需要替換的檔案（1 個）

1. `public/favicon.svg` - 替換為綠色版本（SVG 格式）

### 自動產生的檔案（建置時）

1. `dist/manifest.webmanifest` - PWA manifest
2. `dist/sw.js` - Service Worker
3. `dist/workbox-*.js` - Workbox 執行時

## 潛在問題與解決方案

### 問題 1: DaisyUI 主題色未更新

**症狀**: 修改 `style.css` 後按鈕仍是藍色

**解決方案**:
```bash
# 清除快取
rm -rf node_modules/.vite
bun run build --force

# 如果仍不生效，使用備用方案（HSL 變數）
```

### 問題 2: Service Worker 404

**症狀**: 瀏覽器報告 `GET /sw.js 404`

**解決方案**:
1. 檢查 `dist/sw.js` 是否存在
2. 驗證 `@cloudflare/vite-plugin` 版本 ≥ 1.2.0
3. 確認部署成功

### 問題 3: Manifest 檔案 404

**症狀**: DevTools 警告 `manifest.webmanifest not found`

**解決方案**:
- vite-plugin-pwa 產生的檔案名是 `manifest.webmanifest`（**不是** `manifest.json`）
- 檢查 Layout.tsx 中 `<link rel="manifest" href="/manifest.webmanifest">` 正確

### 問題 4: Icon 顏色不正確

**症狀**: 產生的 PNG 不是綠色

**解決方案**:
- 檢查 SVG 源檔案包含 `fill="#36A45D"`
- 不要使用 `fill="currentColor"`
- ImageMagick 轉換時強制顏色：
  ```bash
  convert icon.svg -background none -fill "#36A45D" -opaque black -resize 192x192 icon-192.png
  ```

### 問題 5: 認證衝突

**症狀**: 使用者登出後，快取的頁面仍顯示已登入狀態

**解決方案**:
- Network First 策略已設定 5 秒超時（優先網路）
- 登出時瀏覽器會因 cookie 被刪除自動清除相關快取
- 可選：在登出 API 回應新增 `Clear-Site-Data` 標頭：
  ```typescript
  return c.json(
    { success: true },
    200,
    { 'Clear-Site-Data': '"cache", "cookies", "storage"' }
  )
  ```

### 問題 6: htmx 請求被快取

**症狀**: 提交表單後看到舊資料

**解決方案**:
- 已配置 `/api/*` 為 `NetworkOnly`（永不快取）
- htmx 請求路徑為 `/api/*`，不受 Service Worker 快取影響

### 問題 7: SVG favicon 不支援

**症狀**: 某些瀏覽器不顯示 SVG favicon

**解決方案**:
- 現代瀏覽器（Chrome 94+、Firefox 41+、Safari 15+）都支援 SVG favicon
- 如需相容舊版瀏覽器，保留 `.ico` 格式作為備用：
  ```tsx
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="alternate icon" type="image/x-icon" href="/favicon.ico" />
  ```

## Cloudflare Workers 特殊處理

### 靜態資源路由

**自動處理**: `@cloudflare/vite-plugin` 會：
1. 將 `/public` 和建置產物複製到 `dist`
2. 在 Workers 程式碼中新增靜態資源路由
3. 自動處理 `/manifest.webmanifest`、`/sw.js` 等請求

**無需**修改 `wrangler.toml`

### 建置產物大小

Cloudflare Workers Free 版限制: 1MB（壓縮後）

**檢查大小**:
```bash
bun run build
wrangler deploy --dry-run
```

**如果超限**:
- 限制快取檔案: `maximumFileSizeToCacheInBytes: 3 * 1024 * 1024`
- 減少 globPatterns
- 使用 `injectManifest` 模式手動撰寫精簡 SW

## 成功標準

### 功能性 ✅
- PWA 可在 Desktop Chrome/Edge 安裝
- PWA 可在 iOS Safari 加入主畫面
- PWA 可在 Android Chrome 安裝
- 安裝後以 standalone 模式啟動
- Service Worker 成功註冊並啟動
- Manifest 所有欄位正確

### 視覺一致性 ✅
- Favicon 為綠色 SVG icon
- Navbar logo 為綠色 SVG
- Login 頁面顯示綠色 logo
- 所有 Primary 按鈕為綠色（#36A45D）
- PWA 安裝橫幅/提示顯示綠色主題
- iOS 主畫面圖示為綠色
- Android Splash Screen 顯示綠色

### 相容性 ✅
- 認證流程正常（登入/登出）
- 訂閱管理功能正常
- 主題切換正常（light/dark）
- htmx 互動正常（表單提交、動態載入）
- Cloudflare Workers 部署成功
- 靜態資源（manifest、SW、icons）可存取

### 效能 ✅
- Lighthouse PWA 分數 ≥ 90
- 建置產物大小 < 1MB（壓縮後）
- 首次載入時間無明顯增加
- Service Worker 啟動時間 < 1 秒

## 未來擴展方向（目前不實施）

符合 YAGNI 原則，以下功能暫不實施：

1. **離線功能增強**
   - 離線表單快取
   - Background Sync 提交

2. **推播通知**
   - Web Push API
   - 訂閱到期提醒推播

3. **進階 PWA 功能**
   - App Shortcuts（快捷方式）
   - Share Target API（分享目標）
   - File Handling API

4. **效能最佳化**
   - 預快取關鍵資源
   - 預載入下一頁

5. **自動更新提示**
   - Toast 通知新版本
   - 強制更新機制

---

## 關鍵檔案路徑總結

### 核心配置檔案
- `vite.config.ts` - PWA 插件配置（最關鍵）
- `tsconfig.json` - TypeScript 類型定義
- `src/style.css` - 主題色自訂

### 元件檔案
- `src/components/Layout.tsx` - PWA meta tags
- `src/components/Navbar.tsx` - Logo 替換
- `src/pages/Login.tsx` - Logo 新增

### 資源檔案
- `public/icon.svg` - 核心視覺資源
- `public/icon-192.png` - PWA icon
- `public/icon-512.png` - PWA icon
- `public/apple-touch-icon.png` - iOS icon
- `public/favicon.svg` - 瀏覽器 favicon（SVG 格式）

---

## 與原手動方案的差異

| 特性 | 手動方案 | vite-plugin-pwa |
|-----|---------|-----------------|
| manifest 建立 | 手動撰寫 JSON | 自動產生 |
| Service Worker | 手動撰寫 | Workbox 自動產生 |
| SW 註冊 | 手動內聯腳本 | 自動注入 |
| 快取策略 | 基礎 Network-first | 豐富的 Workbox 策略 |
| 開發體驗 | 無 HMR 控制 | 可選啟用/停用 |
| 類型支援 | 無 | 完整 TypeScript 支援 |
| 更新機制 | 手動實作 | 內建 autoUpdate |
| 維護成本 | 高 | 低 |

**結論**: vite-plugin-pwa 提供更強大、更易維護的 PWA 解決方案。

---

## SVG Favicon 優勢

使用 SVG 作為 favicon 的好處：

1. **向量圖形**: 任何尺寸都清晰，支援高解析度螢幕
2. **檔案更小**: SVG 通常比 PNG/ICO 更小
3. **主題適應**: 可使用 CSS 變數支援深色模式
4. **單一檔案**: 一個 SVG 適用所有尺寸
5. **現代標準**: 被所有現代瀏覽器支援

**瀏覽器支援**:
- Chrome 94+ ✅
- Firefox 41+ ✅
- Safari 15+ ✅
- Edge 94+ ✅
