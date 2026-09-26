import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { startAuthentication } from '@simplewebauthn/browser'

import { api, ApiError } from '../shared/api'

/** 新增、刪除 passkey 與修改帳號要在 10 分鐘內登入過，超過時 API 回傳這個代碼 */
export const isReauthRequired = (error: unknown) => error instanceof ApiError && error.code === 'REAUTH_REQUIRED'

// 不經過 api()：密碼錯誤的 401 要顯示在畫面上，不是轉到登入頁
export async function reauthWithPassword(username: string, password: string): Promise<void> {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const json = (await response.json()) as Api.Response
  if (!json.success) throw new ApiError(json.message, response.status, json.code)
}

export async function reauthWithPasskey(): Promise<void> {
  const { data: options } = await api<PublicKeyCredentialRequestOptionsJSON>(
    'POST',
    '/api/webauthn/authenticate/options',
    { conditional: false },
  )
  const credential = await startAuthentication({ optionsJSON: options })
  await api('POST', '/api/webauthn/authenticate/verify', credential)
}

/** 使用者關閉 passkey 對話框，不當作錯誤 */
export const isCancel = (error: unknown) =>
  error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'AbortError')
