import { toast } from '../../utils/toast'

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

    // NotifyX
    ;(document.getElementById('notifyxApiKey') as HTMLInputElement).value = config.NOTIFYX_API_KEY || ''

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

    // 更新渠道配置顯示
    toggleChannelConfigs(enabled)
  }
  catch (error) {
    toast.error(`載入配置失敗：${(error as Error).message}`)
  }
}

// 動態顯示/隱藏渠道配置
function toggleChannelConfigs(enabled: string[]): void {
  const map: Record<string, string> = {
    telegram: 'telegramConfig',
    notifyx: 'notifyxConfig',
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
        if (key === 'BARK_SAVE')
          continue
        data[key] = value
      }

      // 處理多選框：ENABLED_NOTIFIERS
      data.ENABLED_NOTIFIERS = Array.from(
        document.querySelectorAll<HTMLInputElement>('[name="ENABLED_NOTIFIERS"]:checked'),
      ).map(el => el.value)

      // 驗證至少選擇一個渠道
      if (data.ENABLED_NOTIFIERS.length === 0) {
        throw new Error('請至少選擇一種通知渠道')
      }

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
})
