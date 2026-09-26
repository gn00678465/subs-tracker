import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { browserSupportsWebAuthnAutofill, startAuthentication } from '@simplewebauthn/browser'

const form = document.getElementById('login-form') as HTMLFormElement
const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement
const error = document.getElementById('login-error') as HTMLParagraphElement
const passkeyButton = document.getElementById('passkey-login') as HTMLButtonElement | null

function showError(message: string | null) {
  error.hidden = !message
  error.textContent = message ?? ''
}

function setBusy(button: HTMLButtonElement, busy: boolean, label: string) {
  button.disabled = busy
  button.setAttribute('aria-disabled', String(busy))
  if (button.lastChild) button.lastChild.textContent = label
}

async function postJson<T>(url: string, body: unknown): Promise<Api.Response<T>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return (await response.json()) as Api.Response<T>
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const data = new FormData(form)
  const username = String(data.get('username') ?? '').trim()
  const password = String(data.get('password') ?? '')
  if (!username || !password) return showError('請輸入使用者名稱和密碼。')

  showError(null)
  setBusy(submit, true, '登入中')
  try {
    const result = await postJson('/api/login', { username, password })
    if (result.success) return location.assign('/admin')
    showError(result.message)
  } catch {
    showError('無法連線，請確認網路後再試一次。')
  }
  setBusy(submit, false, '登入')
})

async function signInWithPasskey(conditional: boolean) {
  const options = await postJson<PublicKeyCredentialRequestOptionsJSON>('/api/webauthn/authenticate/options', {
    conditional,
  })
  if (!options.success || !options.data) throw new Error(options.success ? '伺服器沒有回傳驗證選項' : options.message)
  const credential = await startAuthentication({ optionsJSON: options.data, useBrowserAutofill: conditional })
  const result = await postJson('/api/webauthn/authenticate/verify', credential)
  if (!result.success) throw new Error(result.message)
  location.assign('/admin')
}

// 使用者取消對話框，或另一個 passkey 請求取代了這一個
function isCancel(caught: unknown): boolean {
  return caught instanceof Error && (caught.name === 'NotAllowedError' || caught.name === 'AbortError')
}

passkeyButton?.addEventListener('click', async () => {
  showError(null)
  setBusy(passkeyButton, true, '驗證中')
  try {
    await signInWithPasskey(false)
  } catch (caught) {
    if (!isCancel(caught)) showError(caught instanceof Error ? caught.message : String(caught))
  }
  setBusy(passkeyButton, false, '使用 passkey 登入')
})

if (passkeyButton) {
  browserSupportsWebAuthnAutofill()
    .then((supported) => (supported ? signInWithPasskey(true) : undefined))
    // 自動填入是背景的請求，使用者沒有操作；失敗時仍可用密碼或按鈕登入，不顯示錯誤
    .catch(() => undefined)
}
