import type { FC } from 'hono/jsx'
import { Avatar } from './Avatar'
import ToggleTheme from './ToggleTheme'

interface NavbarProps {
  currentPage: 'admin' | 'config'
  username?: string
}

export const Navbar: FC<NavbarProps> = ({ currentPage, username }) => {
  return (
    <>
      <nav class="navbar bg-base-100 shadow-lg">
        <div class="navbar-start">
          <div class="flex items-center gap-2">
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
            <span class="text-xl font-bold">SubsTracker</span>
          </div>
          <div id="systemTime" class="ml-4 text-sm text-base-content/70"></div>
        </div>

        <div class="navbar-end gap-2">
          <a
            href="/admin"
            class={`btn btn-ghost btn-sm ${currentPage === 'admin' ? 'btn-active' : ''}`}
          >
            <i data-lucide="list" class="size-4"></i>
            訂閱列表
          </a>
          <a
            href="/admin/config"
            class={`btn btn-ghost btn-sm ${currentPage === 'config' ? 'btn-active' : ''}`}
          >
            <i data-lucide="settings" class="size-4"></i>
            系統配置
          </a>

          <ToggleTheme />

          {username
            ? (
                <Avatar username={username} />
              )
            : (
                <a href="/api/logout" class="btn btn-ghost btn-sm">
                  <i data-lucide="log-out" class="size-6"></i>
                  登出
                </a>
              )}
        </div>
      </nav>

      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){const el=document.getElementById('systemTime');function u(){const now=new Date();const y=now.getFullYear();const m=String(now.getMonth()+1).padStart(2,'0');const d=String(now.getDate()).padStart(2,'0');const h=String(now.getHours()).padStart(2,'0');const min=String(now.getMinutes()).padStart(2,'0');const s=String(now.getSeconds()).padStart(2,'0');el.textContent=y+'-'+m+'-'+d+' '+h+':'+min+':'+s;}u();setInterval(u,1000);})();`,
        }}
      />
    </>
  )
}
