import { getSafeRedirectUrl } from '../../utils/url'
import { api, ApiError } from '../lib/api'
import { withLoading } from '../lib/async-ui'
import { el } from '../lib/dom'
// 導入 WebAuthn 登入功能
import './webauthn'

const form = el<HTMLFormElement>('loginForm')
const btn = el<HTMLButtonElement>('submitBtn')
const btnText = el('btnText')
const btnLoading = el('btnLoading')
const errorMsg = el('errorMsg')
const errorText = el('errorText')

function showError(message: string) {
  if (!errorMsg || !errorText)
    return
  errorText.textContent = message
  errorMsg.classList.remove('hidden')
}

form?.addEventListener('submit', async (evt: Event) => {
  evt.preventDefault()

  const formData = new FormData(form)
  const username = formData.get('username')
  const password = formData.get('password')

  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    showError('請輸入用戶名和密碼')
    return
  }

  errorMsg?.classList.add('hidden')

  try {
    await withLoading(
      { button: btn, hide: [btnText], show: [btnLoading] },
      () => api.post<{ username: string }>('/api/login', { username, password }),
    )

    const params = new URLSearchParams(window.location.search)
    window.location.href = getSafeRedirectUrl(params.get('redirect_to'))
  }
  catch (error) {
    showError(error instanceof ApiError ? error.message : '發生錯誤，請稍後再試')
  }
})
