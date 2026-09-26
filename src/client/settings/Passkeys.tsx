import { useState } from 'hono/jsx'
import { Cloud, KeyRound, Pencil, Trash2 } from 'lucide'

import { Icon } from '../../components/Icon'
import type { PasskeyView } from '../../services/passkey'
import { api, errorMessage } from '../shared/api'
import { formatDate } from '../shared/format'
import { toast } from '../shared/toast'

/** 沒有改名時用驗證器的提供者名稱，例如「iCloud 鑰匙圈」 */
export const passkeyName = (passkey: PasskeyView) => passkey.nickname ?? passkey.provider ?? 'Passkey'

function details(passkey: PasskeyView, timezone: string): string {
  const parts = [
    `建立 ${formatDate(passkey.createdAt, timezone)}`,
    `最後使用 ${passkey.lastUsedAt ? formatDate(passkey.lastUsedAt, timezone) : '從未'}`,
  ]
  if (passkey.synced !== null) parts.push(passkey.synced ? '已同步' : '僅限此裝置')
  return parts.join(' · ')
}

interface PasskeysProps {
  passkeys: PasskeyView[]
  readOnly: boolean
  timezone: string
  onRenamed: (passkey: PasskeyView) => void
  onDelete: (passkey: PasskeyView) => Promise<void>
}

export const Passkeys = ({ passkeys, readOnly, timezone, onRenamed, onDelete }: PasskeysProps) => {
  const [renaming, setRenaming] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)

  if (passkeys.length === 0) {
    return <div class="list-foot note">還沒有 passkey。新增後可以用指紋、臉部或安全金鑰登入。</div>
  }

  async function rename(passkey: PasskeyView) {
    try {
      await api('PUT', `/api/webauthn/credentials/${encodeURIComponent(passkey.id)}`, { nickname: name })
      const renamed = { ...passkey, nickname: name.trim() || null }
      onRenamed(renamed)
      setRenaming(null)
      toast(`已改名為「${passkeyName(renamed)}」`)
    } catch (error) {
      toast(errorMessage(error))
    }
  }

  return (
    <>
      {passkeys.map((passkey) => {
        const label = passkeyName(passkey)
        return (
          <div class="passkey">
            <span class="glyph">
              <Icon node={passkey.synced ? Cloud : KeyRound} />
            </span>
            <div>
              <b>{label}</b>
              <small>{details(passkey, timezone)}</small>
              {!passkey.usableHere && <small class="warn">在此網址無法使用</small>}
            </div>
            <div class="passkey-actions">
              <button
                class="icon-btn"
                type="button"
                aria-label={`修改 ${label} 的名稱`}
                aria-disabled={String(readOnly)}
                onClick={() => {
                  if (readOnly) return
                  setName(passkey.nickname ?? label)
                  setRenaming(renaming === passkey.id ? null : passkey.id)
                  setConfirming(null)
                }}
              >
                <Icon node={Pencil} />
              </button>
              <button
                class="icon-btn"
                type="button"
                aria-label={`刪除 ${label}`}
                aria-disabled={String(readOnly)}
                onClick={() => {
                  if (readOnly) return
                  setConfirming(passkey.id)
                  setRenaming(null)
                }}
              >
                <Icon node={Trash2} />
              </button>
            </div>
            {renaming === passkey.id && (
              <div class="rename field">
                <label for="pk-name">名稱</label>
                <div class="form-row" style="grid-template-columns: 1fr auto">
                  <input
                    class="input"
                    id="pk-name"
                    value={name}
                    maxlength={64}
                    onInput={(event: Event) => setName((event.target as HTMLInputElement).value)}
                  />
                  <button class="btn btn-primary" type="button" onClick={() => rename(passkey)}>
                    儲存
                  </button>
                </div>
                <span class="hint">留空表示使用預設名稱。</span>
              </div>
            )}
            {confirming === passkey.id && (
              <div class="confirm">
                <span>{passkeys.length === 1 ? '刪除後只能用密碼登入。確定刪除？' : `刪除「${label}」？`}</span>
                <button
                  class="btn btn-danger-solid"
                  type="button"
                  onClick={() => {
                    setConfirming(null)
                    void onDelete(passkey)
                  }}
                >
                  刪除
                </button>
                <button class="btn btn-secondary" type="button" onClick={() => setConfirming(null)}>
                  取消
                </button>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
