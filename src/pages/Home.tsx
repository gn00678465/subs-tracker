import { Script } from 'vite-ssr-components/hono'

import { Layout } from '../components/Layout'

export const HomePage = () => (
  <Layout title="訂閱 · SubsTracker">
    <div id="app"></div>
    <Script src="/src/client/home/index.tsx" type="module" />
  </Layout>
)
