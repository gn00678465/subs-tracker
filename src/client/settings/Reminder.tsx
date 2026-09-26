import { useState } from 'hono/jsx'

import type { ReminderSettings } from '../../services/settings'
import { api, errorMessage } from '../shared/api'
import { timezoneName } from '../shared/format'
import { toast } from '../shared/toast'
import { SectionSave } from './SectionSave'

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const DAYS = [1, 3, 7, 14, 30]

interface ReminderProps {
  saved: ReminderSettings
  readOnly: boolean
  onSaved: (reminder: ReminderSettings) => void
}

export const Reminder = ({ saved, readOnly, onSaved }: ReminderProps) => {
  const [draft, setDraft] = useState(saved)
  const [busy, setBusy] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const timezones = [...new Set([saved.timezone, ...Intl.supportedValuesOf('timeZone')])]
  const days = [...new Set([...DAYS, draft.defaultReminderDays])].sort((a, b) => a - b)

  const update = (patch: Partial<ReminderSettings>) => {
    setDraft({ ...draft, ...patch })
    setJustSaved(false)
  }
  const numberOf = (event: Event) => Number((event.target as HTMLSelectElement).value)

  async function save() {
    setBusy(true)
    try {
      await api('PUT', '/api/settings/reminder', draft)
      onSaved(draft)
      setJustSaved(true)
      toast('已儲存提醒設定')
    } catch (error) {
      toast(errorMessage(error))
    }
    setBusy(false)
  }

  return (
    <section aria-labelledby="s-remind">
      <h2 id="s-remind">提醒</h2>
      <p>排程每小時檢查一次，只在你設定的時間發送。</p>
      <div class="set-list">
        <div class="set-item">
          <label for="s-hour">每日提醒時間</label>
          <select class="select" id="s-hour" onChange={(event: Event) => update({ reminderHour: numberOf(event) })}>
            {HOURS.map((hour) => (
              <option value={hour} selected={hour === draft.reminderHour}>
                {String(hour).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </div>
        <div class="set-item">
          <label for="s-tz">
            時區<small>{timezoneName(draft.timezone)}</small>
          </label>
          <select
            class="select"
            id="s-tz"
            onChange={(event: Event) => update({ timezone: (event.target as HTMLSelectElement).value })}
          >
            {timezones.map((timezone) => (
              <option value={timezone} selected={timezone === draft.timezone}>
                {timezone.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div class="set-item">
          <label for="s-days">
            預設提前<small>選「沿用預設」的訂閱，在扣款前幾天提醒</small>
          </label>
          <select
            class="select"
            id="s-days"
            onChange={(event: Event) => update({ defaultReminderDays: numberOf(event) })}
          >
            {days.map((value) => (
              <option value={value} selected={value === draft.defaultReminderDays}>
                {value} 天
              </option>
            ))}
          </select>
        </div>
        <div class="set-item stack-item">
          <span>提醒頻率</span>
          <div class="segmented" role="group" aria-label="提醒頻率">
            {(
              [
                ['ONCE', '只提醒一次'],
                ['DAILY', '每天提醒直到扣款'],
              ] as const
            ).map(([mode, label]) => (
              <button
                type="button"
                aria-pressed={String(draft.reminderMode === mode)}
                onClick={() => update({ reminderMode: mode })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <SectionSave label="儲存提醒設定" dirty={dirty} saved={justSaved} busy={busy} readOnly={readOnly} onSave={save} />
    </section>
  )
}
