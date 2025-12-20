import { toApiFormat } from '../../utils/formAdaptor'

const subscriptionForm = document.getElementById('subscriptionForm') as HTMLFormElement
const hasEndDateToggle = document.getElementById('hasEndDate') as HTMLInputElement
const expiryDateField = document.getElementById('expiryDateField') as HTMLLabelElement
const expiryDateInput = document.getElementById('expiryDate') as HTMLInputElement

// 切換到期日期欄位的顯示/隱藏
function toggleExpiryDateField() {
  if (hasEndDateToggle.checked) {
    expiryDateField.style.display = ''
    expiryDateInput.required = true
  }
  else {
    expiryDateField.style.display = 'none'
    expiryDateInput.required = false
  }
}

// 初始化
toggleExpiryDateField()

// 監聽切換事件
hasEndDateToggle.addEventListener('change', toggleExpiryDateField)

subscriptionForm.addEventListener('htmx:beforeRequest', handleFormSubmit)

async function handleFormSubmit(evt: Event) {
  evt.preventDefault()

  const hxEvt = evt as HtmxBeforeRequestEvent
  const formDataObj = hxEvt.detail.requestConfig.formData

  const submitBtn = (evt.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement | null
  const submitText = document.getElementById('submitText')
  const submitLoading = document.getElementById('submitLoading')

  if (submitBtn) {
    submitBtn.disabled = true
  }
  submitText?.classList.add('hidden')
  submitLoading?.classList.remove('hidden')

  const id = (formDataObj.get('id') as string) || ''

  try {
    // 使用 adaptor 轉換表單數據
    const data = toApiFormat(formDataObj)

    if (!data.name) {
      throw new Error('請輸入訂閱名稱')
    }
    if (!data.expiryDate) {
      throw new Error('請選擇到期日期')
    }
    if (!data.periodValue || data.periodValue < 1) {
      throw new Error('周期數值必須大於 0')
    }

    const url = id ? `/api/subscriptions/${id}` : '/api/subscriptions'
    const method = id ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('保存失敗')
    }

    const result = await response.json() as { data?: { id?: string } }
    const savedId = id || result.data?.id

    window.showToast(id ? '更新成功' : '添加成功', 'success')
    const modal = document.getElementById('subscriptionModal') as HTMLDialogElement | null
    modal?.close()

    // 派發成功事件
    document.dispatchEvent(new CustomEvent('subscription-saved', {
      detail: {
        subscriptionId: savedId,
        action: id ? 'update' : 'create',
      },
    }))
  }
  catch (error) {
    // eslint-disable-next-line no-console
    console.error('保存失敗:', error)
    window.showToast('保存失敗，請稍後再試', 'error')

    // 派發失敗事件
    document.dispatchEvent(new CustomEvent('subscription-save-failed', {
      detail: {
        error: error instanceof Error ? error : new Error(String(error)),
        subscriptionId: id || undefined,
      },
    }))
  }
  finally {
    if (submitBtn) {
      submitBtn.disabled = false
    }
    submitText?.classList.remove('hidden')
    submitLoading?.classList.add('hidden')
  }
}
