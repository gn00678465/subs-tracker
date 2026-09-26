import { useState } from 'hono/jsx'
import { ChevronRight, TriangleAlert, WifiOff } from 'lucide'

import { Icon } from '../../components/Icon'
import type { SettingsView } from '../../services/settings'
import type { Subscription } from '../../types'
import { CHANNEL_LABEL, formatDateTime, timezoneName } from '../shared/format'
import { isPaying, money, perYear, tone, totalsBy } from './model'

const VISIBLE_CURRENCIES = 3

export const OfflineBanner = ({ cachedAt, timezone }: { cachedAt: string; timezone: string }) => (
  <div class="banner offline" role="status">
    <Icon node={WifiOff} />
    <span>離線中，顯示 {formatDateTime(cachedAt, timezone)} 的資料。連上網路後才能修改。</span>
  </div>
)

function warningText({ channels, reminder }: SettingsView): string | null {
  const enabled = channels.filter((channel) => channel.enabled)
  if (enabled.length === 0) return '沒有啟用通知管道，提醒不會送出'
  const failed = enabled.filter((channel) => channel.lastStatus === 'failed')
  if (failed.length === 0) return null
  const at = failed[0].lastAttemptAt ? `${formatDateTime(failed[0].lastAttemptAt, reminder.timezone)} 的` : ''
  const names = failed.map((channel) => CHANNEL_LABEL[channel.channel]).join('、')
  return `${at}提醒有 ${failed.length} 個管道發送失敗（${names}）`
}

export const WarningBanner = ({ settings }: { settings: SettingsView }) => {
  const text = warningText(settings)
  return text ? (
    <a class="banner" href="/admin/config">
      <Icon node={TriangleAlert} />
      <span>{text}</span>
      <Icon node={ChevronRight} />
    </a>
  ) : null
}

export const Spend = ({ subs, inPanel = false }: { subs: Subscription[]; inPanel?: boolean }) => {
  const [showAll, setShowAll] = useState(false)
  const paying = subs.filter(isPaying)
  const monthly = totalsBy(paying, (sub) => perYear(sub) / 12)
  if (monthly.length === 0) return null
  const yearly = new Map(totalsBy(paying, perYear))
  const trials = subs.filter((sub) => sub.isActive && sub.isFreeTrial).length
  const hidden = showAll ? 0 : Math.max(0, monthly.length - VISIBLE_CURRENCIES)

  return (
    <div class="spend" style={inPanel ? 'padding: 0' : undefined} aria-label="平均花費">
      {monthly.slice(0, monthly.length - hidden).map(([currency, value]) => (
        <div class="spend-row">
          <span class="cur">{currency}</span>
          <span class="m">{money(currency, value)}</span>
          <span>/月</span>
          <span class="y">{money(currency, yearly.get(currency) ?? 0)}</span>
          <span>/年</span>
        </div>
      ))}
      <div class="spend-note">
        平均值，依貨幣分開{trials > 0 && `；另有 ${trials} 筆試用中，不計入`}
        {hidden > 0 && (
          <>
            {'；'}
            <button class="link" type="button" onClick={() => setShowAll(true)}>
              另 {hidden} 種貨幣
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function categoryBars(subs: Subscription[]): [string, [string, number][]][] {
  const byCurrency = new Map<string, Map<string, number>>()
  for (const sub of subs.filter(isPaying)) {
    const categories = byCurrency.get(sub.currency) ?? new Map<string, number>()
    const category = sub.category || '未分類'
    categories.set(category, (categories.get(category) ?? 0) + perYear(sub) / 12)
    byCurrency.set(sub.currency, categories)
  }
  return [...byCurrency].map(([currency, categories]) => [currency, [...categories].sort((a, b) => b[1] - a[1])])
}

function lastRunText({ lastRun, reminder }: SettingsView) {
  if (!lastRun) return '還沒有執行'
  const at = formatDateTime(lastRun.startedAt, reminder.timezone)
  if (lastRun.error || lastRun.failed > 0) {
    return (
      <span style="color: var(--today)">{`${at}，${lastRun.error ? '執行失敗' : `${lastRun.failed} 則失敗`}`}</span>
    )
  }
  return `${at}，送出 ${lastRun.reminded} 則`
}

export const Side = ({ subs, settings }: { subs: Subscription[]; settings: SettingsView }) => {
  const { reminder, channels } = settings
  const enabled = channels.filter((channel) => channel.enabled).map((channel) => CHANNEL_LABEL[channel.channel])
  return (
    <aside class="side" aria-label="摘要">
      <div class="panel">
        <h3>平均花費</h3>
        <Spend subs={subs} inPanel />
      </div>
      {categoryBars(subs).map(([currency, rows]) => (
        <div class="panel">
          <h3>{currency} 分類每月平均</h3>
          <div class="bars">
            {rows.map(([category, value]) => (
              <div class="bar">
                <span>{category}</span>
                <i style={`width: ${(value / rows[0][1]) * 100}%; background: ${tone(category)}`}></i>
                <span>{money(currency, value)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div class="panel">
        <h3>提醒</h3>
        <dl class="status-list">
          <div>
            <dt>每日提醒時間</dt>
            <dd>
              {String(reminder.reminderHour).padStart(2, '0')}:00（{timezoneName(reminder.timezone)}）
            </dd>
          </div>
          <div>
            <dt>預設提前</dt>
            <dd>{reminder.defaultReminderDays} 天</dd>
          </div>
          <div>
            <dt>通知管道</dt>
            <dd>{enabled.length > 0 ? enabled.join('、') : '沒有啟用'}</dd>
          </div>
          <div>
            <dt>上次執行</dt>
            <dd>{lastRunText(settings)}</dd>
          </div>
        </dl>
      </div>
    </aside>
  )
}
