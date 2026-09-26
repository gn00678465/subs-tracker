import { expect, test } from 'bun:test'

import { emptyDraft, toRequest, validate } from './draft'

const filled = { ...emptyDraft('TWD'), name: 'Netflix', price: '390', expiryDate: '2026-10-01' }

test('errors name the problem and how to fix it', () => {
  expect(validate(emptyDraft('TWD'))).toEqual({
    name: '請輸入名稱',
    price: '請輸入金額',
    expiryDate: '請選擇下次扣款日',
  })
  expect(validate({ ...filled, price: '三百', isFreeTrial: true, expiryDate: '' })).toEqual({
    price: '請輸入數字，例如 390',
    expiryDate: '請選擇試用結束日',
  })
  expect(validate({ ...filled, periodValue: '0', website: 'javascript:alert(1)' })).toEqual({
    periodValue: '請輸入 1 到 999 的整數',
    website: '網址要以 http:// 或 https:// 開頭',
  })
  expect(validate(filled)).toEqual({})
})

test('the request converts types and sends null for cleared optional dates', () => {
  expect(toRequest({ ...filled, price: '11.99', periodValue: '3', reminder: '7', name: '  Netflix  ' })).toEqual({
    name: 'Netflix',
    currency: 'TWD',
    price: 11.99,
    periodValue: 3,
    periodUnit: 'month',
    expiryDate: '2026-10-01',
    autoRenew: true,
    isFreeTrial: false,
    reminder: 7,
    cancelByDate: null,
    category: '',
    paymentMethod: '',
    website: '',
    startDate: null,
    notes: '',
  })
  expect(toRequest({ ...filled, reminder: 'off' }).reminder).toBe('off')
})
