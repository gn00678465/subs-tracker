import { Fingerprint } from 'lucide'
import { Script } from 'vite-ssr-components/hono'

import { Icon } from '../components/Icon'
import { Layout } from '../components/Layout'

export const LoginPage = ({ hasPasskey }: { hasPasskey: boolean }) => (
  <Layout title="登入 · SubsTracker">
    <div class="view">
      <div class="login">
        <div class="brand">
          <div class="brand-stack" aria-hidden="true">
            <i style="background: var(--c-plum)"></i>
            <i style="background: var(--c-green)"></i>
            <i style="background: var(--c-blue)"></i>
          </div>
          <h1>SubsTracker</h1>
          <p>扣款之前，先知道。</p>
        </div>
        <form id="login-form" novalidate>
          <p class="form-error" id="login-error" role="alert" hidden></p>
          <div class="field">
            <label for="l-user">使用者名稱</label>
            <input class="input" id="l-user" name="username" autocomplete="username webauthn" required />
          </div>
          <div class="field">
            <label for="l-pw">密碼</label>
            <input class="input" id="l-pw" name="password" type="password" autocomplete="current-password" required />
          </div>
          <button class="btn btn-primary" type="submit">
            登入
          </button>
        </form>
        {hasPasskey && (
          <>
            <div class="or">或</div>
            <button class="btn btn-secondary" type="button" id="passkey-login">
              <Icon node={Fingerprint} />
              使用 passkey 登入
            </button>
          </>
        )}
      </div>
    </div>
    <Script src="/src/client/login/index.ts" type="module" />
  </Layout>
)
