import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { startAuthentication } from '@simplewebauthn/browser'

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
    if (webauthnLoginBtn) {
      webauthnLoginBtn.classList.add('loading')
      webauthnLoginBtn.setAttribute('disabled', 'true')
    }

    // Step 1: 取得認證選項
    const optionsRes = await fetch('/api/webauthn/authenticate/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })

    const optionsData = await optionsRes.json() as Api.SuccessResponse<PublicKeyCredentialRequestOptionsJSON>

    if (!optionsData.success) {
      showWebAuthnError(optionsData.message || '此使用者尚未註冊 Passkey')
      return
    }

    // Step 2: 啟動 WebAuthn 認證（必須在點擊處理器內）
    const credential = await startAuthentication({
      optionsJSON: optionsData.data!,
    })

    // Step 3: 驗證認證回應
    const verifyRes = await fetch('/api/webauthn/authenticate/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credential),
    })

    const verifyData = await verifyRes.json() as Api.SuccessResponse<null>

    if (verifyData.success) {
      // 認證成功，重定向到管理頁面
      window.location.href = '/admin'
    }
    else {
      showWebAuthnError(verifyData.message || '認證失敗')
    }
  }
  catch (error: any) {
    if (error.name === 'NotAllowedError') {
      showWebAuthnError('認證已取消')
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
    if (webauthnLoginBtn) {
      webauthnLoginBtn.classList.remove('loading')
      webauthnLoginBtn.removeAttribute('disabled')
    }
  }
})
