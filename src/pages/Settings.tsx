import { Script } from 'vite-ssr-components/hono'

import { Layout } from '../components/Layout'

export const SettingsPage = () => (
  <Layout title="設定 · SubsTracker">
    <div id="app"></div>
    <Script src="/src/client/settings/index.tsx" type="module" />
  </Layout>
)
