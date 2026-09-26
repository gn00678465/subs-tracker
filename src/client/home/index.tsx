import { useEffect, useState } from 'hono/jsx'
import { render } from 'hono/jsx/dom'
import { ChevronRight, Plus, Search, Settings, X } from 'lucide'

import { Icon } from '../../components/Icon'
import type { SettingsView } from '../../services/settings'
import type { Subscription } from '../../types'
import { todayIn } from '../../utils/calendarDate'
import { api, errorMessage } from '../shared/api'
import { toast } from '../shared/toast'
import { Card } from './Card'
import type { CardAction } from './Card'
import type { Group } from './model'
import { groupSubscriptions, matchesQuery, money, monthDay, monthDayWeekday, statusOf, totalsBy } from './model'
import { OfflineBanner, Side, Spend, WarningBanner } from './Summary'

interface Data {
  subs: Subscription[]
  settings: SettingsView
  /** 任一個回應來自離線快取時，顯示最舊的快取時間並停用修改 */
  cachedAt: string | null
}

async function load(): Promise<Data> {
  const [subs, settings] = await Promise.all([
    api<Subscription[]>('GET', '/api/subscriptions'),
    api<SettingsView>('GET', '/api/settings'),
  ])
  const cached = [subs.cachedAt, settings.cachedAt].filter((at): at is string => at !== null).sort()
  return { subs: subs.data, settings: settings.data, cachedAt: cached[0] ?? null }
}

const GROUP_TITLE: Record<Exclude<Group, 'paused'>, string> = {
  due: '需要處理',
  week: '7 天內',
  month: '30 天內',
  later: '之後',
}

function subtotal(list: Subscription[]): string {
  return totalsBy(
    list.filter((sub) => !sub.isFreeTrial),
    (sub) => sub.price,
  )
    .map(([currency, value]) => `${currency} ${money(currency, value)}`)
    .join(' · ')
}

const scrollBehavior = (): ScrollBehavior =>
  matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

const App = ({ initial }: { initial: Data }) => {
  const [data, setData] = useState(initial)
  const { subs, settings, cachedAt } = data
  const today = todayIn(settings.reminder.timezone)
  const defaultDays = settings.reminder.defaultReminderDays
  const readOnly = cachedAt !== null

  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [showPaused, setShowPaused] = useState(false)

  const visible = subs.filter((sub) => matchesQuery(sub, query, category))
  const groups = groupSubscriptions(visible, today, defaultDays)
  // 一打開就展開最近一筆扣款
  const [openId, setOpenId] = useState<string | null>(
    () => [...groups.week, ...groups.month, ...groups.later][0]?.id ?? null,
  )
  const categories = [...new Set(subs.map((sub) => sub.category).filter(Boolean))]

  useEffect(() => {
    if (!openId) return
    // 等展開的動畫結束，再把整張卡捲進畫面
    const timer = setTimeout(() => {
      document.querySelector(`.card[data-id="${CSS.escape(openId)}"]`)?.scrollIntoView({
        block: 'nearest',
        behavior: scrollBehavior(),
      })
    }, 300)
    return () => clearTimeout(timer)
  }, [openId])

  useEffect(() => {
    if (searching) document.getElementById('search')?.focus()
  }, [searching])

  const replace = (updated: Subscription) =>
    setData((current) => ({ ...current, subs: current.subs.map((sub) => (sub.id === updated.id ? updated : sub)) }))

  async function act(sub: Subscription, action: CardAction) {
    if (action === 'edit') {
      location.hash = `edit-${sub.id}`
      return
    }
    try {
      if (action === 'renew') {
        const { data: renewed } = await api<Subscription>('POST', `/api/subscriptions/${sub.id}/renew`)
        replace(renewed)
        toast(`已續訂 ${sub.name}，下次扣款日 ${monthDay(renewed.expiryDate)}`)
      } else {
        const { data: toggled } = await api<Subscription>('PUT', `/api/subscriptions/${sub.id}`, {
          isActive: !sub.isActive,
        })
        replace(toggled)
        setOpenId(null)
        toast(toggled.isActive ? `已啟用 ${sub.name}` : `已停用 ${sub.name}，不再提醒`)
      }
    } catch (error) {
      toast(errorMessage(error))
    }
  }

  const card = (sub: Subscription) => (
    <Card
      sub={sub}
      status={statusOf(sub, today, defaultDays)}
      defaultDays={defaultDays}
      open={openId === sub.id}
      readOnly={readOnly}
      onLip={() => setOpenId(openId === sub.id ? null : sub.id)}
      onAction={(action) => act(sub, action)}
    />
  )

  const group = (key: Exclude<Group, 'paused'>) =>
    groups[key].length > 0 && (
      <>
        <div class="group-head">
          <h2>{GROUP_TITLE[key]}</h2>
          <span>{key === 'week' || key === 'month' ? subtotal(groups[key]) : `${groups[key].length} 筆`}</span>
        </div>
        <div class="stack">{groups[key].map(card)}</div>
      </>
    )

  const searchInput = (id: string, className: string) => (
    <label class={className}>
      <Icon node={Search} />
      <input
        id={id}
        type="search"
        placeholder="搜尋名稱、分類、付款方式"
        value={query}
        aria-label="搜尋訂閱"
        onInput={(event: Event) => setQuery((event.target as HTMLInputElement).value)}
      />
    </label>
  )

  const newButtonAttrs = { disabled: readOnly, onClick: () => (location.hash = 'new') }

  const topbar = searching ? (
    <>
      <header class="topbar">
        {searchInput('search', 'search-field')}
        <button
          class="icon-btn"
          type="button"
          aria-label="關閉搜尋"
          onClick={() => {
            setSearching(false)
            setQuery('')
            setCategory('')
          }}
        >
          <Icon node={X} />
        </button>
      </header>
      <div class="chips" role="group" aria-label="分類">
        {['', ...categories].map((value) => (
          <button
            class="chip"
            type="button"
            aria-pressed={String(category === value)}
            onClick={() => setCategory(value)}
          >
            {value || '全部'}
          </button>
        ))}
      </div>
    </>
  ) : (
    <header class="topbar">
      <h1>訂閱</h1>
      {searchInput('search-desk', 'search-field desk-only')}
      <button class="btn btn-primary desk-only" type="button" {...newButtonAttrs}>
        <Icon node={Plus} />
        新增訂閱
      </button>
      <button class="icon-btn mobile-only" type="button" aria-label="搜尋" onClick={() => setSearching(true)}>
        <Icon node={Search} />
      </button>
      <a class="icon-btn" href="/admin/config" aria-label="設定">
        <Icon node={Settings} />
      </a>
    </header>
  )

  const body =
    subs.length === 0 ? (
      <div class="empty">
        <div class="ghost-stack" aria-hidden="true">
          <i></i>
          <i></i>
          <i></i>
        </div>
        <h2 style="margin: 0; font-size: 17px">還沒有訂閱</h2>
        <p>新增第一筆訂閱，扣款前會依你的設定收到提醒。</p>
        <button class="btn btn-primary" type="button" {...newButtonAttrs}>
          <Icon node={Plus} />
          新增訂閱
        </button>
      </div>
    ) : visible.length === 0 ? (
      <div class="empty">
        <p>沒有符合「{query || category}」的訂閱。</p>
      </div>
    ) : (
      <>
        {group('due')}
        <div class="today" role="separator">
          今天 {monthDayWeekday(today)}
        </div>
        {group('week')}
        {group('month')}
        {group('later')}
        {groups.paused.length > 0 && (
          <>
            <button
              class="paused-toggle"
              type="button"
              aria-expanded={String(showPaused)}
              onClick={() => setShowPaused(!showPaused)}
            >
              <span>已停用（{groups.paused.length}）</span>
              <Icon node={ChevronRight} />
            </button>
            {showPaused && <div class="stack">{groups.paused.map(card)}</div>}
          </>
        )}
      </>
    )

  return (
    <div class="view view-home">
      {topbar}
      <div class="home-main">
        {cachedAt ? (
          <OfflineBanner cachedAt={cachedAt} timezone={settings.reminder.timezone} />
        ) : (
          <WarningBanner settings={settings} />
        )}
        <Spend subs={subs} />
        {body}
        <div class="home-foot"></div>
      </div>
      <Side subs={subs} settings={settings} />
      <div class="fab-wrap">
        <button class="fab" type="button" {...newButtonAttrs}>
          <Icon node={Plus} />
          新增訂閱
        </button>
      </div>
    </div>
  )
}

const root = document.getElementById('app') as HTMLElement
load()
  .then((initial) => render(<App initial={initial} />, root))
  .catch((error: unknown) => {
    root.innerHTML = ''
    const message = document.createElement('p')
    message.className = 'empty'
    message.textContent = `無法載入訂閱：${errorMessage(error)}`
    root.appendChild(message)
  })
