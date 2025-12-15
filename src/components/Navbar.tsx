import type { FC } from 'hono/jsx'
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
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
            訂閱列表
          </a>
          <a
            href="/admin/config"
            class={`btn btn-ghost btn-sm ${currentPage === 'config' ? 'btn-active' : ''}`}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            系統配置
          </a>

          <ToggleTheme />

          {username
            ? (
                <div class="dropdown dropdown-end">
                  <label tabindex={0} class="btn btn-ghost btn-sm btn-circle avatar placeholder">
                    <div class="bg-neutral text-neutral-content rounded-full w-8">
                      <span class="text-xs">{username[0].toUpperCase()}</span>
                    </div>
                  </label>
                  <ul
                    tabindex={0}
                    class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52 mt-2"
                  >
                    <li class="menu-title">
                      <span>
                        用戶：
                        {username}
                      </span>
                    </li>
                    <li>
                      <a href="/api/logout">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                          />
                        </svg>
                        登出
                      </a>
                    </li>
                  </ul>
                </div>
              )
            : (
                <a href="/api/logout" class="btn btn-ghost btn-sm">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
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
