/** @jsxImportSource hono/jsx/dom */
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser'
import type { PasskeyCredential } from '../../components/config/PasskeyItem'
import type { Config } from '../../types/index'
import { startRegistration } from '@simplewebauthn/browser'
import { PasskeyList } from '../../components/config/PasskeyList'
import { toast } from '../../utils/toast'
import { api, ApiError } from '../lib/api'
import { withLoading } from '../lib/async-ui'
import { el, els, elx, mount } from '../lib/dom'
import { renderIcons } from '../lib/icons'

// 載入配置
async function loadConfig(): Promise<void> {
  try {
    const config = await api.get<Config>('/api/config')

    elx<HTMLInputElement>('adminUsername').value = config.ADMIN_USERNAME || ''
    const timezoneEl = el<HTMLSelectElement>('timezone')
    if (timezoneEl)
      timezoneEl.value = config.TIMEZONE || 'UTC'

    const hours = config.NOTIFICATION_HOURS || []
    elx<HTMLInputElement>('notificationHours').value = hours.length === 0 ? '*' : hours.join(', ')

    const reminderModeEl = el<HTMLSelectElement>('reminderMode')
    if (reminderModeEl)
      reminderModeEl.value = config.REMINDER_MODE || 'ONCE'

    elx<HTMLInputElement>('apiToken').value = config.API_TOKEN || ''

    const enabled = config.ENABLED_NOTIFIERS || ['notifyx']
    els<HTMLInputElement>('[name="ENABLED_NOTIFIERS"]').forEach((cb) => {
      cb.checked = enabled.includes(cb.value)
    })

    elx<HTMLInputElement>('tgBotToken').value = config.TELEGRAM_BOT_TOKEN || ''
    elx<HTMLInputElement>('tgChatId').value = config.TELEGRAM_CHAT_ID || ''

    elx<HTMLInputElement>('webhookUrl').value = config.WEBHOOK_URL || ''
    const webhookMethodEl = el<HTMLSelectElement>('webhookMethod')
    if (webhookMethodEl)
      webhookMethodEl.value = config.WEBHOOK_METHOD || 'POST'
    elx<HTMLTextAreaElement>('webhookHeaders').value = config.WEBHOOK_HEADERS || ''
    elx<HTMLTextAreaElement>('webhookTemplate').value = config.WEBHOOK_TEMPLATE || ''

    elx<HTMLInputElement>('resendApiKey').value = config.RESEND_API_KEY || ''
    elx<HTMLInputElement>('emailFrom').value = config.EMAIL_FROM || ''
    elx<HTMLInputElement>('emailFromName').value = config.EMAIL_FROM_NAME || ''
    elx<HTMLInputElement>('emailTo').value = config.EMAIL_TO || ''

    elx<HTMLInputElement>('barkServer').value = config.BARK_SERVER || 'https://api.day.app'
    elx<HTMLInputElement>('barkKey').value = config.BARK_KEY || ''
    elx<HTMLInputElement>('barkSave').checked = config.BARK_SAVE === 'true'
    elx<HTMLInputElement>('barkQuery').value = config.BARK_QUERY || ''

    elx<HTMLInputElement>('webauthnEnabled').checked = config.WEBAUTHN_ENABLED || false
    elx<HTMLInputElement>('webauthnRpName').value = config.WEBAUTHN_RP_NAME || 'SubsTracker'
    elx<HTMLInputElement>('webauthnRpId').value = config.WEBAUTHN_RP_ID || ''
    elx<HTMLTextAreaElement>('webauthnRpOrigins').value = (config.WEBAUTHN_RP_ORIGINS || []).join('\n')

    const attestationEl = el<HTMLSelectElement>('webauthnAttestation')
    if (attestationEl)
      attestationEl.value = config.WEBAUTHN_ATTESTATION || 'none'
    const authAttachmentEl = el<HTMLSelectElement>('webauthnAuthAttachment')
    if (authAttachmentEl)
      authAttachmentEl.value = config.WEBAUTHN_AUTHENTICATOR_ATTACHMENT || ''
    const residentKeyEl = el<HTMLSelectElement>('webauthnResidentKey')
    if (residentKeyEl)
      residentKeyEl.value = config.WEBAUTHN_RESIDENT_KEY || 'preferred'
    const userVerificationEl = el<HTMLSelectElement>('webauthnUserVerification')
    if (userVerificationEl)
      userVerificationEl.value = config.WEBAUTHN_USER_VERIFICATION || 'preferred'
    elx<HTMLInputElement>('webauthnTimeout').value = String(config.WEBAUTHN_TIMEOUT || 60000)

    const hints = config.WEBAUTHN_HINTS || []
    els<HTMLInputElement>('[name="WEBAUTHN_HINTS"]').forEach((checkbox) => {
      checkbox.checked = hints.includes(checkbox.value as Config['WEBAUTHN_HINTS'] extends Array<infer U> ? U : never)
    })

    toggleChannelConfigs(enabled)
    await loadPasskeys()
  }
  catch (error) {
    toast.error(`載入配置失敗：${error instanceof ApiError ? error.message : String(error)}`)
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
    const target = el(id)
    if (target) {
      target.classList.toggle('hidden', !enabled.includes(key))
    }
  })
}

function collectConfigFormData(form: HTMLFormElement): Partial<Config> {
  const formData = new FormData(form)
  const data: Partial<Config> = {}

  for (const [key, value] of formData.entries()) {
    if (
      key === 'ENABLED_NOTIFIERS'
      || key === 'WEBAUTHN_HINTS'
      || key === 'BARK_SAVE'
      || key === 'ADMIN_PASSWORD_CONFIRM'
    ) {
      continue
    }
    if (key === 'ADMIN_PASSWORD' && !value) {
      continue
    }
    if (key === 'WEBAUTHN_AUTHENTICATOR_ATTACHMENT') {
      if (value === '')
        continue
      data.WEBAUTHN_AUTHENTICATOR_ATTACHMENT = value as Config['WEBAUTHN_AUTHENTICATOR_ATTACHMENT']
      continue
    }
    if (key === 'WEBAUTHN_TIMEOUT') {
      const numValue = Number.parseInt(String(value), 10)
      if (!Number.isNaN(numValue) && numValue >= 10000 && numValue <= 600000) {
        data.WEBAUTHN_TIMEOUT = numValue
      }
      continue
    }
    // 其餘字串欄位：以 key 對應 Config 的字串型欄位
    ;(data as Record<string, string>)[key] = String(value)
  }

  data.ENABLED_NOTIFIERS = els<HTMLInputElement>('[name="ENABLED_NOTIFIERS"]:checked').map(elm => elm.value)

  const hoursInput = elx<HTMLInputElement>('notificationHours').value.trim()
  data.NOTIFICATION_HOURS = (hoursInput === '*' || !hoursInput)
    ? []
    : hoursInput
        .split(/[,\s]+/)
        .map(h => Number.parseInt(h, 10))
        .filter(h => !Number.isNaN(h) && h >= 0 && h <= 23)

  data.BARK_SAVE = elx<HTMLInputElement>('barkSave').checked ? 'true' : 'false'
  data.WEBAUTHN_ENABLED = elx<HTMLInputElement>('webauthnEnabled').checked

  const originsInput = elx<HTMLTextAreaElement>('webauthnRpOrigins').value.trim()
  data.WEBAUTHN_RP_ORIGINS = originsInput
    ? originsInput.split('\n').filter(line => line.trim())
    : []

  data.WEBAUTHN_HINTS = els<HTMLInputElement>('[name="WEBAUTHN_HINTS"]:checked')
    .map(elm => elm.value) as Config['WEBAUTHN_HINTS']

  return data
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const form = el<HTMLFormElement>('configForm')
  const submitBtn = el<HTMLButtonElement>('submitBtn')
  const submitText = el('submitText')
  const submitLoading = el('submitLoading')

  if (!form || !submitBtn || !submitText || !submitLoading) {
    return
  }

  els<HTMLInputElement>('[name="ENABLED_NOTIFIERS"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const enabled = els<HTMLInputElement>('[name="ENABLED_NOTIFIERS"]:checked').map(elm => elm.value)
      toggleChannelConfigs(enabled)
    })
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    const password = elx<HTMLInputElement>('adminPassword').value.trim()
    const passwordConfirm = elx<HTMLInputElement>('adminPasswordConfirm').value.trim()
    const errorEl = el('passwordMismatchError')

    if (errorEl) {
      errorEl.style.display = 'none'
    }

    if (password || passwordConfirm) {
      if (password !== passwordConfirm) {
        if (errorEl) {
          errorEl.style.display = 'block'
        }
        toast.error('兩次輸入的密碼不一致，請重新輸入')
        return
      }
      if (password.length < 6) {
        toast.error('密碼至少需要 6 個字符')
        return
      }
    }

    try {
      const data = collectConfigFormData(form)

      await withLoading(
        { button: submitBtn, hide: [submitText], show: [submitLoading] },
        () => api.put<Config>('/api/config', data),
      )

      toast.success('配置保存成功')
      await loadConfig()
    }
    catch (error) {
      toast.error(`保存配置失敗：${error instanceof ApiError ? error.message : String(error)}`)
    }
  })

  el<HTMLButtonElement>('generateToken')?.addEventListener('click', () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars[Math.floor(Math.random() * chars.length)]
    }
    elx<HTMLInputElement>('apiToken').value = token
    toast.success('令牌已生成')
  })

  el<HTMLButtonElement>('resetBtn')?.addEventListener('click', () => {
    if (confirm('確定要重置表單嗎？未保存的更改將丟失。')) {
      void loadConfig()
    }
  })

  void loadConfig()

  el<HTMLButtonElement>('registerPasskeyBtn')?.addEventListener('click', () => {
    void registerPasskey()
  })
})

/**
 * 載入 Passkey 列表
 */
async function loadPasskeys(): Promise<void> {
  const passkeyList = el('passkeyList')
  if (!passkeyList)
    return

  try {
    const credentials = await api.get<PasskeyCredential[]>('/api/webauthn/credentials')

    mount(
      passkeyList,
      <PasskeyList
        credentials={credentials}
        onRegister={() => registerPasskey()}
        onEdit={editPasskeyNickname}
        onDelete={deletePasskey}
      />,
    )

    renderIcons(passkeyList)
  }
  catch {
    mount(passkeyList, <div class="text-center text-error py-8">載入失敗</div>)
  }
}

/**
 * 註冊新 Passkey
 */
async function registerPasskey(): Promise<void> {
  const registerBtn = el<HTMLButtonElement>('registerPasskeyBtn')
  const registerIcon = el('registerPasskeyIcon')
  const registerLoading = el('registerPasskeyLoading')

  try {
    await withLoading(
      { button: registerBtn, hide: [registerIcon], show: [registerLoading] },
      async () => {
        const options = await api.post<PublicKeyCredentialCreationOptionsJSON>(
          '/api/webauthn/register/options',
        )

        const credential = await startRegistration({ optionsJSON: options })

        await api.post<null>('/api/webauthn/register/verify', credential)
      },
    )

    toast.success('Passkey 註冊成功！')
    await loadPasskeys()
  }
  catch (error) {
    if (error instanceof Error && error.name === 'NotAllowedError') {
      toast.error('註冊已取消')
    }
    else if (error instanceof Error && error.name === 'NotSupportedError') {
      toast.error('您的瀏覽器不支援 WebAuthn')
    }
    else {
      toast.error(error instanceof ApiError ? error.message : `註冊失敗: ${error instanceof Error ? error.message : '未知錯誤'}`)
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
    await api.delete<null>(`/api/webauthn/credentials/${credentialID}`)
    toast.success('Passkey 已刪除')
    await loadPasskeys()
  }
  catch (error) {
    toast.error(error instanceof ApiError ? error.message : '刪除失敗')
  }
}

/**
 * 編輯 Passkey 暱稱
 */
async function editPasskeyNickname(credentialID: string): Promise<void> {
  const input = prompt('請輸入新的暱稱：')
  if (input === null) {
    toast.info('已取消更新暱稱')
    return
  }
  const nickname = input.trim()
  if (!nickname) {
    toast.error('暱稱不能為空')
    return
  }

  try {
    await api.put<null>(`/api/webauthn/credentials/${credentialID}`, { nickname })
    toast.success('暱稱更新成功')
    await loadPasskeys()
  }
  catch (error) {
    toast.error(error instanceof ApiError ? error.message : '更新失敗')
  }
}
