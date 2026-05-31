import type { Subscription } from '../../types/index'
import { toApiFormat } from '../../utils/formAdaptor'
import { toast } from '../../utils/toast'
import { api, ApiError } from '../lib/api'
import { withLoading } from '../lib/async-ui'
import { el, elx } from '../lib/dom'
import { reloadSubscriptions } from './index'

const subscriptionForm = elx<HTMLFormElement>('subscriptionForm')
const hasEndDateToggle = elx<HTMLInputElement>('hasEndDate')
const expiryDateField = elx<HTMLLabelElement>('expiryDateField')
const expiryDateInput = elx<HTMLInputElement>('expiryDate')

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

toggleExpiryDateField()
hasEndDateToggle.addEventListener('change', toggleExpiryDateField)
subscriptionForm.addEventListener('submit', handleFormSubmit)

async function handleFormSubmit(evt: Event) {
  evt.preventDefault()

  const formDataObj = new FormData(subscriptionForm)
  const submitBtn = subscriptionForm.querySelector<HTMLButtonElement>('button[type="submit"]')
  const submitText = el('submitText')
  const submitLoading = el('submitLoading')

  const id = (formDataObj.get('id') as string) || ''

  try {
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

    await withLoading(
      { button: submitBtn, hide: [submitText], show: [submitLoading] },
      async () => {
        if (id) {
          await api.put<Subscription>(`/api/subscriptions/${id}`, data)
        }
        else {
          await api.post<Subscription>('/api/subscriptions', data)
        }
      },
    )

    toast.success(id ? '更新成功' : '添加成功')
    el<HTMLDialogElement>('subscriptionModal')?.close()
    await reloadSubscriptions()
  }
  catch (error) {
    toast.error(error instanceof ApiError ? error.message : '保存失敗，請稍後再試')
  }
}
