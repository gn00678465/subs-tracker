import { useState } from 'hono/jsx'
import type { IconNode } from 'lucide'
import { BellRing, ChevronRight, Mail, Send, TriangleAlert, Webhook } from 'lucide'

import { Icon } from '../../components/Icon'
import type { ChannelConfig, ChannelField, ChannelId } from '../../db/settings'
import { CHANNEL_FIELD_LABELS } from '../../db/settings'
import type { ChannelView } from '../../services/settings'
import { api, errorMessage } from '../shared/api'
import { CHANNEL_LABEL, formatDateTime } from '../shared/format'
import { toast } from '../shared/toast'

interface FieldSpec {
  field: ChannelField
  type?: 'email' | 'url' | 'switch' | 'method'
  placeholder?: string
  hint?: string
  numeric?: boolean
}

// 依原型的順序；advanced 放進「進階」折疊區
const CHANNEL_FORM: { channel: ChannelId; glyph: IconNode; fields: FieldSpec[]; advanced: FieldSpec[] }[] = [
  {
    channel: 'telegram',
    glyph: Send,
    fields: [
      { field: 'TELEGRAM_BOT_TOKEN', hint: '在 Telegram 找 @BotFather 建立 bot 後取得' },
      { field: 'TELEGRAM_CHAT_ID', numeric: true },
    ],
    advanced: [],
  },
  {
    channel: 'email',
    glyph: Mail,
    fields: [
      { field: 'RESEND_API_KEY', placeholder: 're_…' },
      { field: 'EMAIL_FROM', placeholder: 'reminder@你的網域' },
      { field: 'EMAIL_TO', type: 'email', placeholder: 'you@example.com' },
    ],
    advanced: [{ field: 'EMAIL_FROM_NAME', placeholder: 'SubsTracker' }],
  },
  {
    channel: 'bark',
    glyph: BellRing,
    fields: [{ field: 'BARK_KEY' }],
    advanced: [
      { field: 'BARK_SERVER', type: 'url', placeholder: 'https://api.day.app' },
      { field: 'BARK_SAVE', type: 'switch' },
      { field: 'BARK_QUERY', placeholder: 'sound=alarm&group=訂閱' },
    ],
  },
  {
    channel: 'webhook',
    glyph: Webhook,
    fields: [{ field: 'WEBHOOK_URL', type: 'url', placeholder: 'https://' }],
    advanced: [
      { field: 'WEBHOOK_METHOD', type: 'method' },
      { field: 'WEBHOOK_HEADERS', placeholder: '{"Authorization": "Bearer …"}' },
      { field: 'WEBHOOK_TEMPLATE', placeholder: '{"title": "{{title}}"}' },
    ],
  },
]

interface Draft {
  enabled: boolean
  config: ChannelConfig
}

function status(saved: ChannelView): [string, string] {
  if (!saved.enabled) return ['未設定', '']
  return saved.lastStatus === 'failed' ? ['發送失敗', 'fail'] : ['已啟用', 'on']
}

interface RowProps {
  form: (typeof CHANNEL_FORM)[number]
  saved: ChannelView
  readOnly: boolean
  timezone: string
  onSaved: (channel: ChannelView) => void
}

const ChannelRow = ({ form, saved, readOnly, timezone, onSaved }: RowProps) => {
  const initial: Draft = { enabled: saved.enabled, config: saved.config }
  const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false)
  const label = CHANNEL_LABEL[form.channel]
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const failed = saved.enabled && saved.lastStatus === 'failed'
  const [statusText, statusClass] = status(saved)
  const setField = (field: ChannelField, value: string) =>
    setDraft({ ...draft, config: { ...draft.config, [field]: value } })

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      toast(errorMessage(error))
    }
    setBusy(false)
  }

  const test = () =>
    run(async () => {
      const { data } = await api<{ success: boolean; error?: string }>(
        'POST',
        `/api/settings/channels/${form.channel}/test`,
        { config: draft.config },
      )
      toast(data.success ? `已傳送測試訊息到 ${label}` : `${label} 傳送失敗：${data.error ?? '原因不明'}`)
    })

  const save = () =>
    run(async () => {
      const { data } = await api<ChannelView>('PUT', `/api/settings/channels/${form.channel}`, draft)
      onSaved(data)
      setDraft({ enabled: data.enabled, config: data.config })
      toast(`已儲存 ${label}`)
    })

  const input = (spec: FieldSpec) => {
    const id = `ch-${spec.field}`
    const value = draft.config[spec.field] ?? ''
    if (spec.type === 'switch') {
      return (
        <div class="switch-row">
          <label for={id}>{CHANNEL_FIELD_LABELS[spec.field]}</label>
          <input
            class="switch"
            id={id}
            type="checkbox"
            checked={value === 'true'}
            onChange={(event: Event) => setField(spec.field, String((event.target as HTMLInputElement).checked))}
          />
        </div>
      )
    }
    const onInput = (event: Event) => setField(spec.field, (event.target as HTMLInputElement).value)
    return (
      <div class="field">
        <label for={id}>{CHANNEL_FIELD_LABELS[spec.field]}</label>
        {spec.type === 'method' ? (
          <select class="select" id={id} onChange={onInput}>
            {['POST', 'PUT', 'GET'].map((method) => (
              <option selected={(value || 'POST') === method}>{method}</option>
            ))}
          </select>
        ) : (
          <input
            class="input"
            id={id}
            type={spec.type === 'email' ? 'email' : 'text'}
            inputmode={spec.type === 'url' ? 'url' : spec.numeric ? 'numeric' : undefined}
            autocomplete="off"
            spellcheck={false}
            value={value}
            placeholder={spec.placeholder}
            onInput={onInput}
          />
        )}
        {spec.hint && <span class="hint">{spec.hint}</span>}
      </div>
    )
  }

  return (
    <details class="row" open={failed}>
      <summary>
        <span class="glyph">
          <Icon node={form.glyph} />
        </span>
        <span>{label}</span>
        <span class={`status ${statusClass}`}>{statusText}</span>
        <Icon node={ChevronRight} class="chev" />
      </summary>
      <div class="body">
        {failed && (
          <p class="note" style="color: var(--today)">
            {saved.lastAttemptAt && `${formatDateTime(saved.lastAttemptAt, timezone)} `}發送失敗：
            {saved.lastError ?? '原因不明'}
          </p>
        )}
        <div class="switch-row">
          <label for={`ch-${form.channel}`}>啟用 {label}</label>
          <input
            class="switch"
            id={`ch-${form.channel}`}
            type="checkbox"
            checked={draft.enabled}
            onChange={(event: Event) => setDraft({ ...draft, enabled: (event.target as HTMLInputElement).checked })}
          />
        </div>
        {form.fields.map(input)}
        {form.advanced.length > 0 && (
          <details class="advanced">
            <summary>進階</summary>
            <div class="inner">{form.advanced.map(input)}</div>
          </details>
        )}
        <div class="btn-row">
          <button
            class="btn btn-secondary"
            type="button"
            aria-disabled={String(readOnly || busy)}
            onClick={() => !readOnly && !busy && test()}
          >
            <Icon node={Send} />
            傳送測試
          </button>
          <button
            class="btn btn-primary"
            type="button"
            aria-disabled={String(readOnly || busy || !dirty)}
            onClick={() => !readOnly && !busy && dirty && save()}
          >
            儲存
          </button>
        </div>
      </div>
    </details>
  )
}

interface ChannelsProps {
  channels: ChannelView[]
  readOnly: boolean
  timezone: string
  onSaved: (channel: ChannelView) => void
}

export const Channels = ({ channels, readOnly, timezone, onSaved }: ChannelsProps) => (
  <section aria-labelledby="s-channels">
    <h2 id="s-channels">通知管道</h2>
    <p>提醒會同時送到每個啟用的管道。</p>
    {!channels.some((channel) => channel.enabled) && (
      <div class="banner">
        <Icon node={TriangleAlert} />
        <span>沒有啟用通知管道，提醒不會送出。</span>
      </div>
    )}
    <div class="rows">
      {CHANNEL_FORM.map((form) => {
        const saved = channels.find((channel) => channel.channel === form.channel)
        return (
          saved && <ChannelRow form={form} saved={saved} readOnly={readOnly} timezone={timezone} onSaved={onSaved} />
        )
      })}
    </div>
  </section>
)
