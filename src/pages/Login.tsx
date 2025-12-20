import type { FC } from 'hono/jsx'
import { Layout } from '../components/Layout'
import ThemeToggle from '../components/ToggleTheme'

export const LoginPage: FC = () => {
  return (
    <Layout title="登入 - SubsTracker" description="登入訂閱管理系統">
      <ThemeToggle class="fixed top-4 right-4 z-50" />
      <div class="min-h-screen flex items-center justify-center bg-base-200 p-4">
        <div class="card w-full max-w-md bg-base-100 shadow-xl">
          <div class="card-body">
            {/* 標題 */}
            <div class="text-center mb-6">
              <h1 class="text-3xl font-bold text-base-content">SubsTracker</h1>
              <p class="text-base-content/70 mt-2">登入管理您的訂閱提醒</p>
            </div>

            {/* 表單 */}
            <form id="loginForm" class="space-y-4" hx-post="/api/login" hx-swap="none">
              {/* 用戶名輸入 */}
              <div class="form-control">
                <label class="label" for="username">
                  <span class="label-text">用戶名</span>
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  placeholder="請輸入用戶名"
                  class="input input-bordered w-full"
                  required
                  autocomplete="username"
                />
              </div>

              {/* 密碼輸入 */}
              <div class="form-control">
                <label class="label" for="password">
                  <span class="label-text">密碼</span>
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="請輸入密碼"
                  class="input input-bordered w-full"
                  required
                  autocomplete="current-password"
                />
              </div>

              {/* 錯誤訊息 */}
              <div id="errorMsg" role="alert" class="alert alert-error hidden">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="stroke-current shrink-0 h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span id="errorText"></span>
              </div>

              {/* 提交按鈕 */}
              <div class="form-control mt-6">
                <button type="submit" class="btn btn-square btn-primary w-full" id="submitBtn">
                  <span id="btnLoading" class="loading loading-spinner loading-sm hidden"></span>
                  <span id="btnText">登入</span>
                  <i data-lucide="send-horizontal" class="size-4"></i>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <script type="module" src="/src/client/login/index.ts"></script>
    </Layout>
  )
}
