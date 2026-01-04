import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser'
import { startRegistration } from '@simplewebauthn/browser'
import { toast } from '../../utils/toast'

// TypeScript declaration for Lucide icons
declare global {
  interface Window {
    lucide?: {
      createIcons: () => void
    }
  }
}

// 載入配置
async function loadConfig(): Promise<void> {
  try {
    const res = await fetch('/api/config')
    const data = await res.json() as { success: boolean, data?: any, message?: string }
    if (!data.success)
      throw new Error(data.message)

    const config = data.data

    // 填充基本設定
    ;(document.getElementById('adminUsername') as HTMLInputElement).value = config.ADMIN_USERNAME || ''
    const timezoneEl = document.getElementById('timezone')
    if (timezoneEl)
      (timezoneEl as unknown as HTMLSelectElement).value = config.TIMEZONE || 'UTC'

    // 通知時段
    const hours = config.NOTIFICATION_HOURS || []
    ;(document.getElementById('notificationHours') as HTMLInputElement).value = hours.length === 0 ? '*' : hours.join(', ')

    // 提醒通知頻率
    const reminderModeEl = document.getElementById('reminderMode')
    if (reminderModeEl)
      (reminderModeEl as unknown as HTMLSelectElement).value = config.REMINDER_MODE || 'ONCE'

    // 第三方 API Token
    ;(document.getElementById('apiToken') as HTMLInputElement).value = config.API_TOKEN || ''

    // 啟用的渠道
    const enabled = config.ENABLED_NOTIFIERS || ['notifyx']
    document.querySelectorAll<HTMLInputElement>('[name="ENABLED_NOTIFIERS"]').forEach((cb) => {
      cb.checked = enabled.includes(cb.value)
    })

    // Telegram
    ;(document.getElementById('tgBotToken') as HTMLInputElement).value = config.TELEGRAM_BOT_TOKEN || ''
    ;(document.getElementById('tgChatId') as HTMLInputElement).value = config.TELEGRAM_CHAT_ID || ''

    // Webhook
    ;(document.getElementById('webhookUrl') as HTMLInputElement).value = config.WEBHOOK_URL || ''
    const webhookMethodEl = document.getElementById('webhookMethod')
    if (webhookMethodEl)
      (webhookMethodEl as unknown as HTMLSelectElement).value = config.WEBHOOK_METHOD || 'POST'
    ;(document.getElementById('webhookHeaders') as HTMLTextAreaElement).value = config.WEBHOOK_HEADERS || ''
    ;(document.getElementById('webhookTemplate') as HTMLTextAreaElement).value = config.WEBHOOK_TEMPLATE || ''

    // Email
    ;(document.getElementById('resendApiKey') as HTMLInputElement).value = config.RESEND_API_KEY || ''
    ;(document.getElementById('emailFrom') as HTMLInputElement).value = config.EMAIL_FROM || ''
    ;(document.getElementById('emailFromName') as HTMLInputElement).value = config.EMAIL_FROM_NAME || ''
    ;(document.getElementById('emailTo') as HTMLInputElement).value = config.EMAIL_TO || ''

    // Bark
    ;(document.getElementById('barkServer') as HTMLInputElement).value = config.BARK_SERVER || 'https://api.day.app'
    ;(document.getElementById('barkKey') as HTMLInputElement).value = config.BARK_KEY || ''
    ;(document.getElementById('barkSave') as HTMLInputElement).checked = config.BARK_SAVE === 'true' || config.BARK_SAVE === true
    ;(document.getElementById('barkQuery') as HTMLInputElement).value = config.BARK_QUERY || ''

    // WebAuthn 配置
    ;(document.getElementById('webauthnEnabled') as HTMLInputElement).checked = config.WEBAUTHN_ENABLED || false
    ;(document.getElementById('webauthnRpName') as HTMLInputElement).value = config.WEBAUTHN_RP_NAME || 'SubsTracker'
    ;(document.getElementById('webauthnRpId') as HTMLInputElement).value = config.WEBAUTHN_RP_ID || ''
    const origins = config.WEBAUTHN_RP_ORIGINS || []
    ;(document.getElementById('webauthnRpOrigins') as HTMLTextAreaElement).value = origins.join('\n')
    const attestationEl = document.getElementById('webauthnAttestation')
    if (attestationEl)
      (attestationEl as unknown as HTMLSelectElement).value = config.WEBAUTHN_ATTESTATION || 'none'
    const authAttachmentEl = document.getElementById('webauthnAuthAttachment')
    if (authAttachmentEl)
      (authAttachmentEl as unknown as HTMLSelectElement).value = config.WEBAUTHN_AUTHENTICATOR_ATTACHMENT || ''
    const residentKeyEl = document.getElementById('webauthnResidentKey')
    if (residentKeyEl)
      (residentKeyEl as unknown as HTMLSelectElement).value = config.WEBAUTHN_RESIDENT_KEY || 'preferred'
    const userVerificationEl = document.getElementById('webauthnUserVerification')
    if (userVerificationEl)
      (userVerificationEl as unknown as HTMLSelectElement).value = config.WEBAUTHN_USER_VERIFICATION || 'preferred'
    ;(document.getElementById('webauthnTimeout') as HTMLInputElement).value = String(config.WEBAUTHN_TIMEOUT || 60000)

    // 載入 WEBAUTHN_HINTS（checkbox 組）
    if (config.WEBAUTHN_HINTS) {
      const hints = config.WEBAUTHN_HINTS
      document.querySelectorAll<HTMLInputElement>('[name="WEBAUTHN_HINTS"]').forEach((checkbox) => {
        checkbox.checked = hints.includes(checkbox.value as any)
      })
    }

    // 更新渠道配置顯示
    toggleChannelConfigs(enabled)

    // 載入 Passkey 列表
    loadPasskeys()
  }
  catch (error) {
    toast.error(`載入配置失敗：${(error as Error).message}`)
  }
}

// 動態顯示/隱藏渠道配置
function toggleChannelConfigs(enabled: string[]): void {
  const map: Record<string, string> = {
    telegram: 'telegramConfig',
    webhook: 'webhookConfig',
    email: 'emailConfig',
    bark: 'barkConfig',
  }

  Object.entries(map).forEach(([key, id]) => {
    const el = document.getElementById(id)
    if (el) {
      el.classList.toggle('hidden', !enabled.includes(key))
    }
  })
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('configForm') as HTMLFormElement | null
  const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement | null
  const submitText = document.getElementById('submitText') as HTMLElement | null
  const submitLoading = document.getElementById('submitLoading') as HTMLElement | null

  if (!form || !submitBtn || !submitText || !submitLoading) {
    console.error('[Config] Required elements not found')
    return
  }

  // 監聽渠道選擇變化
  document.querySelectorAll<HTMLInputElement>('[name="ENABLED_NOTIFIERS"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const enabled = Array.from(
        document.querySelectorAll<HTMLInputElement>('[name="ENABLED_NOTIFIERS"]:checked'),
      ).map(el => el.value)
      toggleChannelConfigs(enabled)
    })
  })

  // 表單提交
  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    // ========== 密碼確認驗證 ==========
    const password = (document.getElementById('adminPassword') as HTMLInputElement).value.trim()
    const passwordConfirm = (document.getElementById('adminPasswordConfirm') as HTMLInputElement).value.trim()
    const errorEl = document.getElementById('passwordMismatchError')

    // 重置錯誤訊息
    if (errorEl) {
      errorEl.style.display = 'none'
    }

    // 驗證邏輯：如果任一欄位有值，兩個必須都一致
    if (password || passwordConfirm) {
      if (password !== passwordConfirm) {
        if (errorEl) {
          errorEl.style.display = 'block'
        }
        toast.error('兩次輸入的密碼不一致，請重新輸入')
        return // 阻止表單提交
      }

      // 密碼長度驗證（前端額外檢查）
      if (password.length < 6) {
        toast.error('密碼至少需要 6 個字符')
        return
      }
    }
    // ========== 密碼驗證結束 ==========

    // 顯示 loading
    submitBtn.disabled = true
    submitText.classList.add('hidden')
    submitLoading.classList.remove('hidden')

    try {
      // 收集表單資料
      const formData = new FormData(form)
      const data: Record<string, any> = {}

      // 處理普通欄位
      for (const [key, value] of formData.entries()) {
        if (key === 'ENABLED_NOTIFIERS')
          continue
        if (key === 'ADMIN_PASSWORD' && !value)
          continue
        if (key === 'ADMIN_PASSWORD_CONFIRM')
          continue
        if (key === 'BARK_SAVE')
          continue
        if (key === 'WEBAUTHN_HINTS')
          continue // 多選 select 特殊處理（在後面處理）

        // WebAuthn 特殊處理
        if (key === 'WEBAUTHN_AUTHENTICATOR_ATTACHMENT') {
          // 空字串表示"不限制"，不送出此欄位（使用後端預設 undefined）
          if (value === '')
            continue
          data[key] = value
          continue
        }

        if (key === 'WEBAUTHN_TIMEOUT') {
          // 將字串轉為數字
          const numValue = Number.parseInt(value as string, 10)
          if (!Number.isNaN(numValue) && numValue >= 10000 && numValue <= 600000) {
            data[key] = numValue
          }
          continue
        }

        data[key] = value
      }

      // 處理多選框：ENABLED_NOTIFIERS
      data.ENABLED_NOTIFIERS = Array.from(
        document.querySelectorAll<HTMLInputElement>('[name="ENABLED_NOTIFIERS"]:checked'),
      ).map(el => el.value)

      // 處理通知時段
      const hoursInput = (document.getElementById('notificationHours') as HTMLInputElement).value.trim()
      if (hoursInput === '*' || !hoursInput) {
        data.NOTIFICATION_HOURS = []
      }
      else {
        data.NOTIFICATION_HOURS = hoursInput
          .split(/[,\s]+/)
          .map(h => Number.parseInt(h, 10))
          .filter(h => !Number.isNaN(h) && h >= 0 && h <= 23)
      }

      // 處理 Bark Save checkbox
      data.BARK_SAVE = (document.getElementById('barkSave') as HTMLInputElement).checked ? 'true' : 'false'

      // 處理 WebAuthn Enabled checkbox
      data.WEBAUTHN_ENABLED = (document.getElementById('webauthnEnabled') as HTMLInputElement).checked

      // 處理 WebAuthn RP Origins（textarea 轉陣列）
      const originsInput = (document.getElementById('webauthnRpOrigins') as HTMLTextAreaElement).value.trim()
      data.WEBAUTHN_RP_ORIGINS = originsInput
        ? originsInput.split('\n').filter(line => line.trim())
        : []

      // 處理 WebAuthn Hints（checkbox 組轉陣列）
      data.WEBAUTHN_HINTS = Array.from(
        document.querySelectorAll<HTMLInputElement>('[name="WEBAUTHN_HINTS"]:checked'),
      ).map(el => el.value)

      // 發送請求
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await res.json() as { success: boolean, message?: string }

      if (result.success) {
        toast.success('配置保存成功')
        // 重新載入配置
        setTimeout(() => loadConfig(), 1000)
      }
      else {
        throw new Error(result.message || '保存失敗')
      }
    }
    catch (error) {
      toast.error(`保存配置失敗：${(error as Error).message}`)
    }
    finally {
      // 恢復按鈕狀態
      submitBtn.disabled = false
      submitText.classList.remove('hidden')
      submitLoading.classList.add('hidden')
    }
  })

  // 生成 Token 按鈕
  document.getElementById('generateToken')?.addEventListener('click', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars[Math.floor(Math.random() * chars.length)]
    }
    (document.getElementById('apiToken') as HTMLInputElement).value = token
    toast.success('令牌已生成')
  })

  // 重置按鈕
  document.getElementById('resetBtn')?.addEventListener('click', () => {
    if (confirm('確定要重置表單嗎？未保存的更改將丟失。')) {
      loadConfig()
    }
  })

  // 初始化
  loadConfig()

  // 註冊 Passkey 按鈕
  document.getElementById('registerPasskeyBtn')?.addEventListener('click', (e) => {
    registerPasskey(e.currentTarget as HTMLButtonElement)
  })

  // 暴露函數到全域作用域（供 HTML onclick 使用）
  ;(window as any).registerPasskey = registerPasskey
  ;(window as any).deletePasskey = deletePasskey
  ;(window as any).editPasskeyNickname = editPasskeyNickname
})

/**
 * 載入 Passkey 列表
 */
async function loadPasskeys(): Promise<void> {
  const passkeyList = document.getElementById('passkeyList')
  if (!passkeyList)
    return

  try {
    const res = await fetch('/api/webauthn/credentials')
    const data = await res.json() as Api.SuccessResponse<string[]>

    if (!data.success) {
      passkeyList.innerHTML = '<div class="text-center text-base-content/70 py-8">載入失敗</div>'
      return
    }

    const credentials = data.data || []

    if (credentials.length === 0) {
      passkeyList.innerHTML = `
        <div class="card bg-base-200 border-2 border-dashed border-base-300">
          <div class="card-body items-center text-center py-12">
            <div class="bg-primary/10 rounded-full p-4 mb-4">
              <i data-lucide="fingerprint" class="size-12 text-primary"></i>
            </div>
            <h5 class="font-semibold text-lg">尚未註冊 Passkey</h5>
            <p class="text-sm text-base-content/70 max-w-md mt-2">
              Passkey 讓您可以使用指紋、臉部辨識或安全金鑰快速登入，無需記憶密碼
            </p>
            <button type="button" class="btn btn-primary btn-sm mt-4" onclick="registerPasskey(this)">
              <i data-lucide="plus" class="size-4"></i>
              註冊第一個 Passkey
            </button>
          </div>
        </div>
      `
      // 重新初始化 Lucide icons
      if (window.lucide) {
        window.lucide.createIcons()
      }
      return
    }

    // 渲染列表
    passkeyList.innerHTML = credentials.map((cred: any) => `
      <div class="card bg-base-200">
        <div class="card-body p-4">
          <div class="flex justify-between items-start">
            <div class="flex-1">
              <h5 class="font-semibold text-base">
                ${cred.nickname || '未命名 Passkey'}
              </h5>
              <div class="text-sm text-base-content/70 mt-1">
                <div>建立於：${new Date(cred.createdAt).toLocaleString('zh-TW')}</div>
                ${cred.lastUsedAt ? `<div>最後使用：${new Date(cred.lastUsedAt).toLocaleString('zh-TW')}</div>` : ''}
                ${cred.transports ? `<div>傳輸方式：${cred.transports.join(', ')}</div>` : ''}
              </div>
            </div>
            <div class="flex gap-2">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                onclick="editPasskeyNickname('${cred.credentialID}')"
              >
                <i data-lucide="edit-3" class="size-4"></i>
              </button>
              <button
                type="button"
                class="btn btn-error btn-sm"
                onclick="deletePasskey('${cred.credentialID}')"
              >
                <i data-lucide="trash-2" class="size-4"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `).join('')

    // 重新初始化 Lucide icons
    if (window.lucide) {
      window.lucide.createIcons()
    }
  }
  catch {
    passkeyList.innerHTML = '<div class="text-center text-error py-8">載入失敗</div>'
  }
}

/**
 * 註冊新 Passkey
 * @param clickedButton 被點擊的按鈕元素（可選，用於禁用該按鈕）
 */
async function registerPasskey(clickedButton?: HTMLButtonElement): Promise<void> {
  try {
    // 頂部按鈕（用於顯示 loading 狀態）
    const registerBtn = document.getElementById('registerPasskeyBtn') as HTMLButtonElement
    const registerIcon = document.getElementById('registerPasskeyIcon')
    const registerLoading = document.getElementById('registerPasskeyLoading')

    // 禁用頂部按鈕
    if (registerBtn) {
      registerBtn.setAttribute('disabled', 'true')
    }
    // 禁用被點擊的按鈕（如果是空狀態按鈕）
    if (clickedButton && clickedButton !== registerBtn) {
      clickedButton.setAttribute('disabled', 'true')
    }
    // 顯示 loading 狀態
    if (registerIcon) {
      registerIcon.classList.add('hidden')
    }
    if (registerLoading) {
      registerLoading.classList.remove('hidden')
    }

    // Step 1: 取得註冊選項
    const optionsRes = await fetch('/api/webauthn/register/options', {
      method: 'POST',
      credentials: 'include',
    })

    const optionsData = await optionsRes.json() as Api.SuccessResponse<PublicKeyCredentialCreationOptionsJSON>

    if (!optionsData.success) {
      toast.error(optionsData.message || '無法開始註冊')
      return
    }

    // Step 2: 啟動註冊（必須在點擊處理器內）
    const credential = await startRegistration({
      optionsJSON: optionsData.data!,
    })

    // Step 3: 驗證註冊
    const verifyRes = await fetch('/api/webauthn/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(credential),
    })

    const verifyData = await verifyRes.json() as Api.SuccessResponse<null>

    if (verifyData.success) {
      toast.success('Passkey 註冊成功！')
      // 重新載入列表
      loadPasskeys()
    }
    else {
      toast.error(verifyData.message || '註冊失敗')
    }
  }
  catch (error: any) {
    if (error.name === 'NotAllowedError') {
      toast.error('註冊已取消')
    }
    else if (error.name === 'NotSupportedError') {
      toast.error('您的瀏覽器不支援 WebAuthn')
    }
    else {
      toast.error(`註冊失敗: ${error.message || '未知錯誤'}`)
    }
  }
  finally {
    const registerBtn = document.getElementById('registerPasskeyBtn') as HTMLButtonElement
    const registerIcon = document.getElementById('registerPasskeyIcon')
    const registerLoading = document.getElementById('registerPasskeyLoading')

    // 恢復頂部按鈕狀態
    if (registerBtn) {
      registerBtn.removeAttribute('disabled')
    }
    // 恢復被點擊按鈕狀態（如果是空狀態按鈕）
    if (clickedButton && clickedButton !== registerBtn) {
      clickedButton.removeAttribute('disabled')
    }
    if (registerIcon) {
      registerIcon.classList.remove('hidden')
    }
    if (registerLoading) {
      registerLoading.classList.add('hidden')
    }
  }
}

/**
 * 刪除 Passkey
 */
async function deletePasskey(credentialID: string): Promise<void> {
  if (!confirm('確定要刪除此 Passkey 嗎？此操作無法復原。')) {
    return
  }

  try {
    const res = await fetch(`/api/webauthn/credentials/${credentialID}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    const data = await res.json() as Api.SuccessResponse<null>

    if (data.success) {
      toast.success('Passkey 已刪除')
      loadPasskeys()
    }
    else {
      toast.error(data.message || '刪除失敗')
    }
  }
  catch (error) {
    toast.error(`刪除失敗：${(error as Error).message}`)
  }
}

/**
 * 編輯 Passkey 暱稱
 */
async function editPasskeyNickname(credentialID: string): Promise<void> {
  const input = prompt('請輸入新的暱稱：')
  // 使用者取消輸入
  if (input === null) {
    toast.info('已取消更新暱稱')
    return
  }
  const nickname = input.trim()
  // 暱稱不得為空白
  if (!nickname) {
    toast.error('暱稱不能為空')
    return
  }

  try {
    const res = await fetch(`/api/webauthn/credentials/${credentialID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nickname }),
    })

    const data = await res.json() as Api.SuccessResponse<null>

    if (data.success) {
      toast.success('暱稱更新成功')
      loadPasskeys()
    }
    else {
      toast.error(data.message || '更新失敗')
    }
  }
  catch (error) {
    toast.error(`更新失敗：${(error as Error).message}`)
  }
}
