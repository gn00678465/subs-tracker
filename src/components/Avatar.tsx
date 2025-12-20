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
            <i data-lucide="log-out" class="size-4"></i>
            登出
          </a>
        </li>
      </ul>
    </div>
  )
}
