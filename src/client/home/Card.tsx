import { CalendarCheck, ExternalLink, Pause, Pencil, Play } from 'lucide'

import { Icon } from '../../components/Icon'
import type { Subscription } from '../../types'
import type { CardStatus } from './model'
import { countdownText, monthDayWeekday, money, periodText, reminderDays, tone, whenText } from './model'

export type CardAction = 'edit' | 'renew' | 'toggle'

interface CardProps {
  sub: Subscription
  status: CardStatus
  defaultDays: number
  open: boolean
  /** 離線時不能修改 */
  readOnly: boolean
  /** 表單上方的預覽 */
  preview?: boolean
  onLip: () => void
  onAction: (action: CardAction) => void
}

function tags(sub: Subscription): string[] {
  const list: string[] = []
  if (sub.isFreeTrial) list.push('試用')
  else if (!sub.autoRenew && sub.isActive) list.push('手動續訂')
  if (sub.reminder === 'off' && sub.isActive) list.push('未設提醒')
  if (!sub.isActive) list.push('已停用')
  return list
}

// 舊資料的網站沒有檢查過協定，只把 http(s) 顯示成連結
const isWebUrl = (url: string) => /^https?:\/\//i.test(url)

export const Card = ({ sub, status, defaultDays, open, readOnly, preview, onLip, onAction }: CardProps) => {
  const { days, soon, group } = status
  const amount = `${sub.currency} ${money(sub.currency, sub.price)}`
  const reminder = reminderDays(sub, defaultDays)
  const date = monthDayWeekday(sub.expiryDate)
  const dateLine = sub.isFreeTrial ? `${date} 試用結束` : days < 0 ? `${date} 應扣款` : `${date} 扣款`
  const className = [
    'card',
    preview && 'preview-card',
    open && 'is-open',
    soon && 'is-soon',
    !sub.isActive && 'state-paused',
    group === 'due' && 'state-expired',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div class={className} style={`--tone: ${tone(sub.category)}`} data-id={sub.id}>
      <button class="lip" type="button" aria-expanded={String(open)} onClick={onLip}>
        <span class="lip-name">
          <span class="n">
            <span class="t">{sub.name}</span>
            {tags(sub).map((tag) => (
              <span class="tag">{tag}</span>
            ))}
          </span>
          <span class="sub">
            <span>{sub.category || '未分類'}</span>
            <span>{sub.paymentMethod}</span>
          </span>
        </span>
        <span class="lip-meta">
          <span class="amt">
            {amount}
            <small>{periodText(sub)}</small>
          </span>
          <span class="when">{sub.isActive ? whenText(sub, days) : '—'}</span>
        </span>
      </button>
      <div class="detail">
        <div class="detail-inner">
          <div class="detail-body">
            <div class="detail-amount">
              <div class="price">
                {amount}
                <small>{periodText(sub)}</small>
              </div>
              <div class="countdown">
                {dateLine}
                <b>{sub.isActive ? countdownText(days) : '已停用'}</b>
              </div>
            </div>
            <div class="facts">
              <span>
                分類<b>{sub.category || '未分類'}</b>
              </span>
              <span>
                付款方式<b>{sub.paymentMethod || '—'}</b>
              </span>
              <span>
                提醒<b>{reminder === null ? '不提醒' : `前 ${reminder} 天`}</b>
              </span>
            </div>
            {sub.cancelByDate && (
              <div class="facts">
                <span>
                  取消期限<b>{monthDayWeekday(sub.cancelByDate)} 前取消</b>
                </span>
              </div>
            )}
            <div class="card-actions">
              <button type="button" disabled={readOnly} onClick={() => onAction('edit')}>
                <Icon node={Pencil} />
                編輯
              </button>
              {!sub.autoRenew && sub.isActive && !sub.isFreeTrial && (
                <button type="button" disabled={readOnly} onClick={() => onAction('renew')}>
                  <Icon node={CalendarCheck} />
                  已續訂
                </button>
              )}
              <button type="button" disabled={readOnly} onClick={() => onAction('toggle')}>
                <Icon node={sub.isActive ? Pause : Play} />
                {sub.isActive ? '停用' : '啟用'}
              </button>
              {isWebUrl(sub.website) && (
                <a href={sub.website} target="_blank" rel="noopener">
                  <Icon node={ExternalLink} />
                  前往網站
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
