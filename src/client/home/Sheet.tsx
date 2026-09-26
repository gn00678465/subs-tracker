import { useEffect, useState } from 'hono/jsx'
import { LoaderCircle, Trash2, X } from 'lucide'

import { Icon } from '../../components/Icon'
import type { PeriodUnit, Subscription } from '../../types'
import type { CalendarDate } from '../../utils/calendarDate'
import { api, ApiError, errorMessage } from '../shared/api'
import { toast } from '../shared/toast'
import { Card } from './Card'
import type { Draft, DraftErrors, DraftField } from './draft'
import { CURRENCIES, draftOf, emptyDraft, lastCurrency, previewOf, toRequest, validate } from './draft'
import { statusOf } from './model'

const UNITS: [PeriodUnit, string][] = [
  ['day', '天'],
  ['week', '週'],
  ['month', '月'],
  ['year', '年'],
]
const REMINDER_DAYS = [1, 3, 7, 14, 30]
const MORE_FIELDS: DraftField[] = ['category', 'paymentMethod', 'website', 'startDate', 'notes']

interface SheetProps {
  /** null 代表新增 */
  sub: Subscription | null
  subs: Subscription[]
  today: CalendarDate
  defaultDays: number
  onSaved: (sub: Subscription) => void
  onDeleted: (sub: Subscription) => void
  onClose: () => void
}

const distinct = (values: string[]) => [...new Set(values.filter(Boolean))]

export const Sheet = ({ sub, subs, today, defaultDays, onSaved, onDeleted, onClose }: SheetProps) => {
  const [draft, setDraft] = useState<Draft>(() => (sub ? draftOf(sub) : emptyDraft(lastCurrency(subs))))
  const [errors, setErrors] = useState<DraftErrors>({})
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    document.getElementById('f-name')?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const set = <K extends DraftField>(field: K, value: Draft[K]) => {
    setDraft({ ...draft, [field]: value })
    if (errors[field]) setErrors({ ...errors, [field]: undefined })
  }
  const text = (field: DraftField) => (event: Event) => set(field, (event.target as HTMLInputElement).value)
  const checked = (field: 'autoRenew' | 'isFreeTrial') => (event: Event) =>
    set(field, (event.target as HTMLInputElement).checked)

  const error = (field: DraftField) =>
    errors[field] && (
      <span class="error" id={`e-${field}`}>
        {errors[field]}
      </span>
    )
  const invalid = (field: DraftField) => ({
    'aria-invalid': String(Boolean(errors[field])),
    'aria-describedby': errors[field] ? `e-${field}` : undefined,
  })

  async function save(event: Event) {
    event.preventDefault()
    const found = validate(draft)
    setErrors(found)
    const first = Object.keys(found)[0]
    if (first) {
      if (MORE_FIELDS.includes(first as DraftField)) (document.querySelector('.more') as HTMLDetailsElement).open = true
      // 等錯誤訊息繪製後再移動焦點，讀螢幕軟體才會讀到 aria-describedby
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[name="${first}"]`)?.focus())
      return
    }
    setBusy(true)
    try {
      const { data: saved } = sub
        ? await api<Subscription>('PUT', `/api/subscriptions/${sub.id}`, toRequest(draft))
        : await api<Subscription>('POST', '/api/subscriptions', toRequest(draft))
      onSaved(saved)
      toast(`已儲存 ${saved.name}`)
    } catch (caught) {
      setBusy(false)
      if (caught instanceof ApiError && caught.fieldErrors.length > 0) {
        setErrors(Object.fromEntries(caught.fieldErrors.map((field) => [field.path, field.message])))
      }
      toast(errorMessage(caught))
    }
  }

  async function remove() {
    if (!sub) return
    setBusy(true)
    try {
      await api('DELETE', `/api/subscriptions/${sub.id}`)
      onDeleted(sub)
      toast(`已刪除 ${sub.name}`)
    } catch (caught) {
      setBusy(false)
      toast(errorMessage(caught))
    }
  }

  const preview = previewOf(draft, today)
  const dateLabel = draft.isFreeTrial ? '試用結束日' : '下次扣款日'
  const reminderOptions: [string, string][] = [
    ['default', `沿用預設（${defaultDays} 天前）`],
    ['off', '不提醒'],
    ...distinct([...REMINDER_DAYS.map(String), draft.reminder])
      .filter((value) => /^\d+$/.test(value))
      .sort((a, b) => Number(a) - Number(b))
      .map((value): [string, string] => [value, `${value} 天前`]),
  ]
  const currencies = distinct([...CURRENCIES, draft.currency])

  // 根用單一元素，不用 fragment：hono/jsx 4.13 每次更新都把根 fragment 的節點重新插入 DOM，
  // 欄位在第一個字之後就失去焦點，開啟動畫也重播
  return (
    <div>
      <div class="scrim" onClick={onClose}></div>
      <form class="sheet" novalidate aria-labelledby="sheet-title" onSubmit={save}>
        <div class="sheet-head">
          <button class="icon-btn" type="button" aria-label="取消" onClick={onClose}>
            <Icon node={X} />
          </button>
          <h2 id="sheet-title">{sub ? `編輯 ${sub.name}` : '新增訂閱'}</h2>
        </div>
        <div class="sheet-body">
          <div inert aria-hidden="true">
            <Card
              sub={preview}
              status={statusOf(preview, today, defaultDays)}
              defaultDays={defaultDays}
              open={false}
              readOnly
              preview
              onLip={() => undefined}
              onAction={() => undefined}
            />
          </div>
          <div class="form-group">
            <div class="field">
              <label for="f-name">名稱</label>
              <input
                class="input"
                id="f-name"
                name="name"
                value={draft.name}
                placeholder="例如 Netflix 標準方案"
                autocomplete="off"
                onInput={text('name')}
                {...invalid('name')}
              />
              {error('name')}
            </div>
            <div class="field">
              <label for="f-price">金額</label>
              <div class="form-row">
                <select class="select" name="currency" aria-label="貨幣" onChange={text('currency')}>
                  {currencies.map((currency) => (
                    <option selected={currency === draft.currency}>{currency}</option>
                  ))}
                </select>
                <input
                  class="input num"
                  id="f-price"
                  name="price"
                  inputmode="decimal"
                  value={draft.price}
                  placeholder="390"
                  onInput={text('price')}
                  {...invalid('price')}
                />
              </div>
              {error('price')}
            </div>
            <div class="field">
              <span style="font-size: 13px; font-weight: 500">付款週期</span>
              <div class="period-row">
                <span>每</span>
                <input
                  class="input num"
                  name="periodValue"
                  inputmode="numeric"
                  value={draft.periodValue}
                  aria-label="週期數量"
                  onInput={text('periodValue')}
                  {...invalid('periodValue')}
                />
                <div class="segmented" role="group" aria-label="週期單位">
                  {UNITS.map(([unit, label]) => (
                    <button
                      type="button"
                      aria-pressed={String(unit === draft.periodUnit)}
                      onClick={() => set('periodUnit', unit)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {error('periodValue')}
            </div>
            <div class="field">
              <label for="f-date">{dateLabel}</label>
              <input
                class="input num"
                id="f-date"
                name="expiryDate"
                type="date"
                value={draft.expiryDate}
                onInput={text('expiryDate')}
                {...invalid('expiryDate')}
              />
              {error('expiryDate')}
            </div>
          </div>
          <div class="form-group">
            <div class="switch-row">
              <label for="f-auto">
                自動續訂<small>扣款後自動算出下一次的日期</small>
              </label>
              <input
                class="switch"
                id="f-auto"
                type="checkbox"
                checked={draft.autoRenew}
                onChange={checked('autoRenew')}
              />
            </div>
            <div class="switch-row">
              <label for="f-trial">
                試用中<small>不計入花費，提醒改為「試用即將結束」</small>
              </label>
              <input
                class="switch"
                id="f-trial"
                type="checkbox"
                checked={draft.isFreeTrial}
                onChange={checked('isFreeTrial')}
              />
            </div>
            <div class="field">
              <label for="f-reminder">提醒</label>
              <select class="select" id="f-reminder" name="reminder" onChange={text('reminder')}>
                {reminderOptions.map(([value, label]) => (
                  <option value={value} selected={value === draft.reminder}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div class="field">
              <label for="f-cancel">取消期限（選填）</label>
              <input
                class="input num"
                id="f-cancel"
                name="cancelByDate"
                type="date"
                value={draft.cancelByDate}
                onInput={text('cancelByDate')}
              />
              <span class="hint">要在這天之前取消才不會扣款。設了這個日期時，提醒依它計算。</span>
            </div>
          </div>
          <details class="more">
            <summary>
              更多<span>分類、付款方式、網站、開始日、備註</span>
            </summary>
            <div class="inner">
              <div class="field">
                <label for="f-category">分類</label>
                <input
                  class="input"
                  id="f-category"
                  name="category"
                  list="dl-category"
                  value={draft.category}
                  placeholder="例如 影音"
                  onInput={text('category')}
                />
                <datalist id="dl-category">
                  {distinct(subs.map((item) => item.category)).map((value) => (
                    <option value={value}></option>
                  ))}
                </datalist>
              </div>
              <div class="field">
                <label for="f-payment">付款方式</label>
                <input
                  class="input"
                  id="f-payment"
                  name="paymentMethod"
                  list="dl-payment"
                  value={draft.paymentMethod}
                  placeholder="例如 玉山 Pi 卡"
                  onInput={text('paymentMethod')}
                />
                <datalist id="dl-payment">
                  {distinct(subs.map((item) => item.paymentMethod)).map((value) => (
                    <option value={value}></option>
                  ))}
                </datalist>
              </div>
              <div class="field">
                <label for="f-site">網站</label>
                <input
                  class="input"
                  id="f-site"
                  name="website"
                  type="url"
                  inputmode="url"
                  value={draft.website}
                  placeholder="https://"
                  onInput={text('website')}
                  {...invalid('website')}
                />
                {error('website')}
              </div>
              <div class="field">
                <label for="f-start">開始日</label>
                <input
                  class="input num"
                  id="f-start"
                  name="startDate"
                  type="date"
                  value={draft.startDate}
                  onInput={text('startDate')}
                />
              </div>
              <div class="field">
                <label for="f-notes">備註</label>
                <textarea class="input" id="f-notes" name="notes" value={draft.notes} onInput={text('notes')} />
              </div>
            </div>
          </details>
        </div>
        <div class="sheet-foot">
          {confirmingDelete ? (
            <div class="confirm" style="flex: 1">
              <span>刪除後無法復原。</span>
              <button class="btn btn-danger-solid" type="button" disabled={busy} onClick={remove}>
                刪除
              </button>
              <button class="btn btn-secondary" type="button" onClick={() => setConfirmingDelete(false)}>
                取消
              </button>
            </div>
          ) : (
            <>
              {sub && (
                <button class="btn btn-danger" type="button" onClick={() => setConfirmingDelete(true)}>
                  <Icon node={Trash2} />
                  刪除
                </button>
              )}
              <button class="btn btn-primary" type="submit" disabled={busy} aria-disabled={String(busy)}>
                {busy ? (
                  <>
                    <Icon node={LoaderCircle} class="spin" />
                    儲存中
                  </>
                ) : (
                  '儲存'
                )}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
