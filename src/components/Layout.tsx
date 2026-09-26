import { raw } from 'hono/html'
import type { FC, PropsWithChildren } from 'hono/jsx'
import { Link, Script, ViteClient } from 'vite-ssr-components/hono'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Barlow+Semi+Condensed:wght@500;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap'

// 主題只存在瀏覽器。在第一次繪製前套用，避免先顯示另一個主題
const APPLY_THEME = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`

// 頁面的 <Script> 要寫在頁面裡，src 用字串常值：vite-ssr-components 靠掃描原始碼找出要打包的檔案
export const Layout: FC<PropsWithChildren<{ title: string }>> = ({ children, title }) => (
  <>
    {raw('<!doctype html>')}
    <html lang="zh-TW">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{title}</title>
        <script dangerouslySetInnerHTML={{ __html: APPLY_THEME }} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#eceef1" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0d0f12" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="SubsTracker" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link rel="stylesheet" href={FONTS} />
        <ViteClient />
        <Link href="/src/style.css" rel="stylesheet" />
        <Script src="/src/client/registerSW.ts" type="module" />
      </head>
      <body>{children}</body>
    </html>
  </>
)
