import { getSafeRedirectUrl } from '../../utils/url'
// 導入 WebAuthn 登入功能
import './webauthn'

const form = document.getElementById('loginForm') as HTMLFormElement | null
const btn = document.getElementById('submitBtn') as HTMLButtonElement | null
const btnText = document.getElementById('btnText') as HTMLElement | null
const btnLoading = document.getElementById('btnLoading') as HTMLElement | null
const errorMsg = document.getElementById('errorMsg') as HTMLElement | null
const errorText = document.getElementById('errorText') as HTMLElement | null

function resetButtonState() {
  if (!btn || !btnText || !btnLoading)
    return
  btn.disabled = false
  btnText.classList.remove('hidden')
  btnLoading.classList.add('hidden')
}

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

  if (!btn || !btnText || !btnLoading)
    return
  btn.disabled = true
  btnText.classList.add('hidden')
  btnLoading.classList.remove('hidden')

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        password,
      }),
    })

    const data = await response.json() as Api.Response<{ username: string }>

    if (data.success) {
      const params = new URLSearchParams(window.location.search)
      const redirectTo = getSafeRedirectUrl(params.get('redirect_to'))
      window.location.href = redirectTo
    }
    else {
      showError(data.message || '登入失敗，請檢查用戶名和密碼')
      resetButtonState()
    }
  }
  catch {
    showError('發生錯誤，請稍後再試')
    resetButtonState()
  }
})
