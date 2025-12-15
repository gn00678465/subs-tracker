import type { PropsWithChildren } from 'hono/jsx'

export interface AvatarProps extends PropsWithChildren {
  username: string
}

export function Avatar({ username }: AvatarProps) {
  return (
    <div class="dropdown dropdown-end">
      <div tabindex={0} role="button" class="avatar avatar-placeholder cursor-pointer">
        <div class="bg-neutral text-neutral-content w-8 rounded-full">
          <span class="text-xs">{username[0].toUpperCase()}</span>
        </div>
      </div>
      <ul
        tabindex={-1}
        class="dropdown-content menu bg-base-100 rounded-box z-1 w-40 p-2 shadow-sm"
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
}
