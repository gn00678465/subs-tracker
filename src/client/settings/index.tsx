import { useState } from 'hono/jsx'
import { render } from 'hono/jsx/dom'
import { ArrowLeft, Download, WifiOff } from 'lucide'

import { Icon } from '../../components/Icon'
import type { SettingsView } from '../../services/settings'
import { api, errorMessage } from '../shared/api'
import { formatDateTime } from '../shared/format'
import { Account } from './Account'
import { Channels } from './Channels'
import { Reminder } from './Reminder'

type Theme = '' | 'light' | 'dark'

const THEMES: [Theme, string][] = [
  ['', '跟隨系統'],
  ['light', '淺色'],
  ['dark', '深色'],
]

// 主題只存在這個瀏覽器；Layout 在第一次繪製前讀取同一個鍵
function applyTheme(theme: Theme) {
  if (theme) document.documentElement.dataset.theme = theme
  else delete document.documentElement.dataset.theme
  try {
    if (theme) localStorage.setItem('theme', theme)
    else localStorage.removeItem('theme')
  } catch {
    // 無痕視窗可能不能寫入；這次瀏覽仍然套用
  }
}

const Look = () => {
  const [theme, setTheme] = useState<Theme>((document.documentElement.dataset.theme as Theme | undefined) ?? '')
  return (
    <section aria-labelledby="s-look">
      <h2 id="s-look">外觀</h2>
      <p>只影響這個瀏覽器。</p>
      <div class="segmented" role="group" aria-label="主題">
        {THEMES.map(([value, label]) => (
          <button
            type="button"
            aria-pressed={String(theme === value)}
            onClick={() => {
              applyTheme(value)
              setTheme(value)
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  )
}

const App = ({ initial, cachedAt }: { initial: SettingsView; cachedAt: string | null }) => {
  const [settings, setSettings] = useState(initial)
  const readOnly = cachedAt !== null
  const { timezone } = settings.reminder

  return (
    <div class="view view-settings">
      <header class="topbar">
        <a class="icon-btn" href="/admin" aria-label="回到訂閱">
          <Icon node={ArrowLeft} />
        </a>
        <h1>設定</h1>
      </header>
      {cachedAt && (
        <div class="banner offline" role="status">
          <Icon node={WifiOff} />
          <span>離線中，顯示 {formatDateTime(cachedAt, timezone)} 的設定。連上網路後才能修改。</span>
        </div>
      )}
      <div class="settings">
        <Reminder
          saved={settings.reminder}
          readOnly={readOnly}
          onSaved={(reminder) => setSettings({ ...settings, reminder })}
        />
        <Channels
          channels={settings.channels}
          readOnly={readOnly}
          timezone={timezone}
          onSaved={(saved) =>
            setSettings({
              ...settings,
              channels: settings.channels.map((channel) => (channel.channel === saved.channel ? saved : channel)),
            })
          }
        />
        <Account
          username={settings.account.username}
          readOnly={readOnly}
          timezone={timezone}
          onSaved={(username) => setSettings({ ...settings, account: { username } })}
        />
        <section aria-labelledby="s-data">
          <h2 id="s-data">資料</h2>
          <p>下載所有訂閱與設定。檔案不含密碼、登入金鑰與通知管道的憑證。</p>
          {readOnly ? (
            <button class="btn btn-secondary" type="button" aria-disabled="true">
              <Icon node={Download} />
              匯出 JSON
            </button>
          ) : (
            <a class="btn btn-secondary" href="/api/settings/export" download>
              <Icon node={Download} />
              匯出 JSON
            </a>
          )}
        </section>
        <Look />
      </div>
    </div>
  )
}

const root = document.getElementById('app') as HTMLElement
api<SettingsView>('GET', '/api/settings')
  .then(({ data, cachedAt }) => render(<App initial={data} cachedAt={cachedAt} />, root))
  .catch((error: unknown) => {
    const message = document.createElement('p')
    message.className = 'empty'
    message.textContent = `無法載入設定：${errorMessage(error)}`
    root.appendChild(message)
  })
