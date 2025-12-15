import type { FC, PropsWithChildren } from 'hono/jsx'
import { Link, ViteClient } from 'vite-ssr-components/hono'

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

        <ViteClient />
        <script src="https://unpkg.com/htmx.org@2.0.4"></script>
        <Link href="/src/style.css" rel="stylesheet" />

        {/* 主題初始化 - 在渲染前執行，避免 FOUC (Flash of Unstyled Content) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){const theme=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',theme);})();`,
          }}
        />

        {/* 載入主題切換模組 */}
        <script type="module" src="/src/utils/themeToggle.ts"></script>
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
