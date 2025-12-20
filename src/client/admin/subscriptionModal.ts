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
  const formData = Object.fromEntries(hxEvt.detail.requestConfig.formData.entries())

  console.log('提交表單數據:', formData)

  const submitBtn = (evt.target as HTMLFormElement).querySelector('button[type="submit"]') as HTMLButtonElement | null
  const submitText = document.getElementById('submitText')
  const submitLoading = document.getElementById('submitLoading')

  if (submitBtn) {
    submitBtn.disabled = true
  }
  submitText?.classList.add('hidden')
  submitLoading?.classList.remove('hidden')

  // 使用 formData 而非直接從 DOM 取得資料
  const id = (formData.id as string) || ''

  try {
    const data = {
      name: (formData.name as string)?.trim(),
      customType: (formData.customType as string)?.trim() || undefined,
      category: (formData.category as string)?.trim() || undefined,
      currency: (formData.currency as string) || undefined,
      price: (formData.price as string) || undefined,
      startDate: (formData.startDate as string) || undefined,
      expiryDate: formData.expiryDate as string,
      periodValue: Number.parseInt(formData.periodValue as string),
      periodUnit: formData.periodUnit as string,
      periodMethod: (formData.periodMethod as string) || undefined,
      website: (formData.website as string)?.trim() || undefined,
      reminderMe: formData.reminderMe ? Number.parseInt(formData.reminderMe as string) : undefined,
      notes: (formData.notes as string)?.trim() || undefined,
      // Checkbox 欄位：值為 "on" 表示勾選，欄位不存在表示未勾選
      isActive: formData.isActive === 'on',
      autoRenew: formData.autoRenew === 'on',
      isFreeTrial: formData.isFreeTrial === 'on',
      isReminderSet: formData.isReminderSet === 'on',
    }

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
      const error = await response.json()
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
