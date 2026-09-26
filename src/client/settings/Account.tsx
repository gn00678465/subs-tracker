import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser'
import { startRegistration } from '@simplewebauthn/browser'
import { useEffect, useState } from 'hono/jsx'
import { Fingerprint, LogOut, Plus } from 'lucide'

import { Icon } from '../../components/Icon'
import type { PasskeyView } from '../../services/passkey'
import { api, errorMessage, isCancel } from '../shared/api'
import { toast } from '../shared/toast'
import { Passkeys, passkeyName } from './Passkeys'
import { isReauthRequired, reauthWithPasskey, reauthWithPassword } from './reauth'
import { SectionSave } from './SectionSave'

interface Reauth {
  where: 'account' | 'passkeys'
  purpose: string
  retry: () => Promise<void>
}

interface ReauthPanelProps {
  reauth: Reauth
  username: string
  canUsePasskey: boolean
  onDone: () => void
  onCancel: () => void
}

const ReauthPanel = ({ reauth, username, canUsePasskey, onDone, onCancel }: ReauthPanelProps) => {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => document.getElementById('reauth-pw')?.focus(), [])

  async function confirm(method: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await method()
      onDone()
    } catch (caught) {
      if (!isCancel(caught)) setError(errorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <div class="reauth">
      <p class="note">上次登入超過 10 分鐘。請先確認身分，再{reauth.purpose}。</p>
      {error && (
        <p class="form-error" role="alert">
          {error}
        </p>
      )}
      <div class="field">
        <label for="reauth-pw">密碼</label>
        <input
          class="input"
          id="reauth-pw"
          type="password"
          autocomplete="current-password"
          value={password}
          onInput={(event: Event) => setPassword((event.target as HTMLInputElement).value)}
          onKeyDown={(event: KeyboardEvent) =>
            event.key === 'Enter' && password && confirm(() => reauthWithPassword(username, password))
          }
        />
      </div>
      <div class="btn-row">
        <button
          class="btn btn-primary"
          type="button"
          aria-disabled={String(busy || !password)}
          onClick={() => !busy && password && confirm(() => reauthWithPassword(username, password))}
        >
          確認
        </button>
        {canUsePasskey && (
          <button
            class="btn btn-secondary"
            type="button"
            aria-disabled={String(busy)}
            onClick={() => !busy && confirm(reauthWithPasskey)}
          >
            <Icon node={Fingerprint} />
            改用 passkey 確認
          </button>
        )}
        <button class="btn btn-secondary" type="button" onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  )
}

interface AccountProps {
  username: string
  readOnly: boolean
  timezone: string
  onSaved: (username: string) => void
}

export const Account = ({ username, readOnly, timezone, onSaved }: AccountProps) => {
  const empty = { username, password: '', confirm: '' }
  const [draft, setDraft] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [reauth, setReauth] = useState<Reauth | null>(null)
  const [passkeys, setPasskeys] = useState<PasskeyView[] | null>(null)
  const [passkeyError, setPasskeyError] = useState<string | null>(null)
  const dirty = draft.username.trim() !== username || draft.password !== '' || draft.confirm !== ''

  useEffect(() => {
    api<PasskeyView[]>('GET', '/api/webauthn/credentials')
      .then(({ data }) => setPasskeys(data))
      .catch((error: unknown) => setPasskeyError(errorMessage(error)))
  }, [])

  const update = (field: keyof typeof empty) => (event: Event) => {
    setDraft({ ...draft, [field]: (event.target as HTMLInputElement).value })
    setJustSaved(false)
  }

  // 需要重新驗證時，驗證成功後再執行一次同一個動作
  async function guarded(where: Reauth['where'], purpose: string, action: () => Promise<void>) {
    try {
      await action()
    } catch (error) {
      if (isReauthRequired(error)) setReauth({ where, purpose, retry: action })
      else if (!isCancel(error)) toast(errorMessage(error))
    }
  }

  async function saveAccount() {
    const name = draft.username.trim()
    if (!name) return toast('請輸入使用者名稱')
    if (draft.password && draft.password.length < 8) return toast('新密碼至少要 8 個字元')
    if (draft.password !== draft.confirm) return toast('兩次輸入的新密碼不同')
    setBusy(true)
    await guarded('account', '儲存帳號', async () => {
      await api('PUT', '/api/settings/account', {
        ...(name !== username && { username: name }),
        ...(draft.password && { password: draft.password }),
      })
      onSaved(name)
      setDraft({ username: name, password: '', confirm: '' })
      setJustSaved(true)
      toast('已儲存帳號')
    })
    setBusy(false)
  }

  const addPasskey = () =>
    guarded('passkeys', '新增 passkey', async () => {
      const { data: options } = await api<PublicKeyCredentialCreationOptionsJSON>(
        'POST',
        '/api/webauthn/register/options',
      )
      const credential = await startRegistration({ optionsJSON: options }).catch((error: unknown) => {
        if (error instanceof Error && error.name === 'InvalidStateError') {
          throw new Error('這個裝置已經有這個網站的 passkey。')
        }
        throw error
      })
      const { data: created } = await api<PasskeyView>('POST', '/api/webauthn/register/verify', credential)
      setPasskeys((current) => [...(current ?? []), created])
      toast(`已新增 passkey「${passkeyName(created)}」`)
    })

  const deletePasskey = (passkey: PasskeyView) =>
    guarded('passkeys', '刪除 passkey', async () => {
      await api('DELETE', `/api/webauthn/credentials/${encodeURIComponent(passkey.id)}`)
      setPasskeys((current) => (current ?? []).filter((item) => item.id !== passkey.id))
      toast(`已刪除 passkey「${passkeyName(passkey)}」`)
    })

  const reauthPanel = (where: Reauth['where']) =>
    reauth?.where === where && (
      <ReauthPanel
        reauth={reauth}
        username={username}
        canUsePasskey={(passkeys ?? []).some((passkey) => passkey.usableHere)}
        onDone={() => {
          setReauth(null)
          void guarded(reauth.where, reauth.purpose, reauth.retry)
        }}
        onCancel={() => setReauth(null)}
      />
    )

  return (
    <section aria-labelledby="s-account">
      <h2 id="s-account">帳號與登入</h2>
      <p>只有一組帳號。修改使用者名稱不會影響 passkey。</p>
      <div class="set-list">
        <div class="set-item">
          <label for="a-user">使用者名稱</label>
          <input
            class="input"
            id="a-user"
            value={draft.username}
            autocomplete="username"
            onInput={update('username')}
          />
        </div>
        <div class="set-item">
          <label for="a-pw">
            新密碼<small>至少 8 個字元；留空表示不修改</small>
          </label>
          <input
            class="input"
            id="a-pw"
            type="password"
            autocomplete="new-password"
            value={draft.password}
            onInput={update('password')}
          />
        </div>
        <div class="set-item">
          <label for="a-pw2">確認新密碼</label>
          <input
            class="input"
            id="a-pw2"
            type="password"
            autocomplete="new-password"
            value={draft.confirm}
            onInput={update('confirm')}
          />
        </div>
        {reauthPanel('account')}
      </div>
      <SectionSave
        label="儲存帳號"
        dirty={dirty}
        saved={justSaved}
        busy={busy}
        readOnly={readOnly}
        onSave={saveAccount}
      />

      <h3 style="font-size: 15px; margin: 24px 0 8px">Passkey</h3>
      <div class="set-list passkeys">
        {passkeys ? (
          <Passkeys
            passkeys={passkeys}
            readOnly={readOnly}
            timezone={timezone}
            onRenamed={(renamed) =>
              setPasskeys((current) => (current ?? []).map((item) => (item.id === renamed.id ? renamed : item)))
            }
            onDelete={deletePasskey}
          />
        ) : (
          <div class="list-foot note">{passkeyError ? `無法讀取 passkey：${passkeyError}` : '讀取中'}</div>
        )}
        {reauthPanel('passkeys')}
        <div class="list-foot">
          <button
            class="btn btn-secondary"
            type="button"
            aria-disabled={String(readOnly || !passkeys)}
            onClick={() => !readOnly && passkeys && addPasskey()}
          >
            <Icon node={Plus} />
            新增 passkey
          </button>
        </div>
      </div>
      <div class="section-save" style="justify-content: flex-start">
        <a class="btn btn-secondary" href="/api/logout">
          <Icon node={LogOut} />
          登出
        </a>
      </div>
    </section>
  )
}
