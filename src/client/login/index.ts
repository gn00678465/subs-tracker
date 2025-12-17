import type { ApiResponse } from '../../types/api'

const form = document.getElementById('loginForm') as HTMLFormElement | null
const btn = document.getElementById('submitBtn') as HTMLButtonElement | null
const btnText = document.getElementById('btnText') as HTMLElement | null
const btnLoading = document.getElementById('btnLoading') as HTMLElement | null
const errorMsg = document.getElementById('errorMsg') as HTMLElement | null
const errorText = document.getElementById('errorText') as HTMLElement | null

// Helper function to reset button state
function resetButtonState() {
  if (!btn || !btnText || !btnLoading)
    return
  btn.disabled = false
  btnText.classList.remove('hidden')
  btnLoading.classList.add('hidden')
}

// Helper function to show error message
function showError(message: string) {
  if (!errorMsg || !errorText)
    return
  errorText.textContent = message
  errorMsg.classList.remove('hidden')
}

form?.addEventListener('htmx:beforeRequest', async (evt: Event) => {
  evt.preventDefault()
  const hxEvt = evt as HtmxBeforeRequestEvent
  const username = hxEvt.detail.requestConfig.formData.get('username')
  const password = hxEvt.detail.requestConfig.formData.get('password')

  // Type guard: ensure values are strings, not File objects
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    showError('請輸入用戶名和密碼')
    return
  }

  // 隱藏錯誤訊息
  errorMsg?.classList.add('hidden')

  // 顯示 loading 狀態
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

    const data = await response.json() as ApiResponse<{ username: string }>

    if (data.success) {
      // 登入成功，重定向到管理頁面
      window.location.href = '/admin'
    }
    else {
      // 登入失敗，顯示錯誤訊息
      showError(data.message || '登入失敗，請檢查用戶名和密碼')
      resetButtonState()
    }
  }
  catch (error) {
    // 發生錯誤
    showError('發生錯誤，請稍後再試')
    resetButtonState()
  }
})
