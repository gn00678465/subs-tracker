import type { FC, PropsWithChildren } from 'hono/jsx'
import { Link, Script, ViteClient } from 'vite-ssr-components/hono'

interface LayoutProps {
  title?: string
  description?: string
}

export const Layout: FC<PropsWithChildren<LayoutProps>> = ({
  children,
  title = 'SubsTracker',
  description = '訂閱管理系統',
}) => {
  return (
    <html lang="zh-TW" data-theme="light">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content={description} />
        <title>{title}</title>

        {/* PWA Meta Tags */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#36A45D" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* iOS Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SubsTracker" />

        <ViteClient />
        <Link href="/src/style.css" rel="stylesheet" />
        <Script src="/src/client/icons.ts" type="module" />
        {/* 載入主題切換模組 */}
        <Script src="/src/utils/themeToggle.ts" type="module" />

        {/* 載入 Toast 通知模組 */}
        <Script src="/src/utils/toast.ts" type="module" />

        {/* 載入 ConfirmDialog 模組 */}
        <Script src="/src/utils/confirmDialog.ts" type="module" />

        {/* 載入 Service Worker 註冊 */}
        <Script src="/src/client/registerSW.ts" type="module" />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
