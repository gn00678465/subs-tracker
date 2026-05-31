import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser'
import { startAuthentication } from '@simplewebauthn/browser'
import { getSafeRedirectUrl } from '../../utils/url'
import { api, ApiError } from '../lib/api'
import { withLoading } from '../lib/async-ui'
import { el } from '../lib/dom'

const webauthnLoginBtn = el<HTMLButtonElement>('webauthnLoginBtn')
const usernameInput = el<HTMLInputElement>('username')
const errorMsgElement = el('errorMsg')
const errorTextElement = el('errorText')

function showWebAuthnError(message: string) {
  if (errorMsgElement && errorTextElement) {
    errorTextElement.textContent = message
    errorMsgElement.classList.remove('hidden')
  }
}

function hideWebAuthnError() {
  errorMsgElement?.classList.add('hidden')
}

webauthnLoginBtn?.addEventListener('click', async (e) => {
  e.preventDefault()
  hideWebAuthnError()

  const username = usernameInput?.value?.trim()
  if (!username) {
    showWebAuthnError('請先輸入用戶名')
    return
  }

  if (!window.PublicKeyCredential) {
    showWebAuthnError('您的瀏覽器不支援 WebAuthn')
    return
  }

  const webauthnIcon = el('webauthnLoginIcon')
  const webauthnLoading = el('webauthnLoginLoading')

  try {
    await withLoading(
      { button: webauthnLoginBtn, hide: [webauthnIcon], show: [webauthnLoading] },
      async () => {
        const options = await api.post<PublicKeyCredentialRequestOptionsJSON>(
          '/api/webauthn/authenticate/options',
          { username },
        )

        const credential = await startAuthentication({ optionsJSON: options })

        await api.post<null>('/api/webauthn/authenticate/verify', credential)
      },
    )

    const params = new URLSearchParams(window.location.search)
    window.location.href = getSafeRedirectUrl(params.get('redirect_to'))
  }
  catch (error) {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      hideWebAuthnError()
    }
    else if (error instanceof Error && error.name === 'NotSupportedError') {
      showWebAuthnError('您的瀏覽器不支援此功能')
    }
    else {
      showWebAuthnError(error instanceof ApiError ? error.message : `認證失敗: ${error instanceof Error ? error.message : '未知錯誤'}`)
    }
  }
})
