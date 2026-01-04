import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { startAuthentication } from '@simplewebauthn/browser'
import { getSafeRedirectUrl } from '../../utils/url'

/**
 * WebAuthn 登入流程
 */

const webauthnLoginBtn = document.getElementById('webauthnLoginBtn')
const usernameInput = document.getElementById('username') as HTMLInputElement
const errorMsgElement = document.getElementById('errorMsg')
const errorTextElement = document.getElementById('errorText')

function showWebAuthnError(message: string) {
  if (errorMsgElement && errorTextElement) {
    errorTextElement.textContent = message
    errorMsgElement.classList.remove('hidden')
  }
}

function hideWebAuthnError() {
  if (errorMsgElement) {
    errorMsgElement.classList.add('hidden')
  }
}

webauthnLoginBtn?.addEventListener('click', async (e) => {
  e.preventDefault()
  hideWebAuthnError()

  const username = usernameInput?.value?.trim()

  if (!username) {
    showWebAuthnError('請先輸入用戶名')
    return
  }

  // 檢查瀏覽器支援
  if (!window.PublicKeyCredential) {
    showWebAuthnError('您的瀏覽器不支援 WebAuthn')
    return
  }

  try {
    // 顯示 loading 狀態
    const webauthnIcon = document.getElementById('webauthnLoginIcon')
    const webauthnLoading = document.getElementById('webauthnLoginLoading')

    if (webauthnLoginBtn) {
      webauthnLoginBtn.setAttribute('disabled', 'true')
    }
    if (webauthnIcon) {
      webauthnIcon.classList.add('hidden')
    }
    if (webauthnLoading) {
      webauthnLoading.classList.remove('hidden')
    }

    // Step 1: 取得認證選項
    const optionsRes = await fetch('/api/webauthn/authenticate/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })

    const optionsData = await optionsRes.json() as Api.SuccessResponse<PublicKeyCredentialRequestOptionsJSON>

    if (!optionsData.success) {
      showWebAuthnError(optionsData.message || '認證初始化失敗')
      return
    }

    if (!optionsData.data) {
      showWebAuthnError('伺服器回傳資料格式錯誤')
      return
    }

    // Step 2: 啟動 WebAuthn 認證（必須在點擊處理器內）
    const credential = await startAuthentication({
      optionsJSON: optionsData.data,
    })

    // Step 3: 驗證認證回應
    const verifyRes = await fetch('/api/webauthn/authenticate/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credential),
    })

    const verifyData = await verifyRes.json() as Api.SuccessResponse<null>

    if (verifyData.success) {
      // 認證成功，重定向到管理頁面（支援 redirect_to 參數，並進行安全驗證）
      const params = new URLSearchParams(window.location.search)
      const redirectTo = getSafeRedirectUrl(params.get('redirect_to'))
      window.location.href = redirectTo
    }
    else {
      showWebAuthnError(verifyData.message || '認證失敗')
    }
  }
  catch (error: any) {
    if (error.name === 'NotAllowedError') {
      // 使用者主動取消，靜默處理（不顯示錯誤）
      hideWebAuthnError()
    }
    else if (error.name === 'NotSupportedError') {
      showWebAuthnError('您的瀏覽器不支援此功能')
    }
    else {
      showWebAuthnError(`認證失敗: ${error.message || '未知錯誤'}`)
    }
  }
  finally {
    // 恢復按鈕狀態
    const webauthnIcon = document.getElementById('webauthnLoginIcon')
    const webauthnLoading = document.getElementById('webauthnLoginLoading')

    if (webauthnLoginBtn) {
      webauthnLoginBtn.removeAttribute('disabled')
    }
    if (webauthnIcon) {
      webauthnIcon.classList.remove('hidden')
    }
    if (webauthnLoading) {
      webauthnLoading.classList.add('hidden')
    }
  }
})
