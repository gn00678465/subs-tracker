import { expect, test } from 'bun:test'

import { sendToChannel } from './index'

test('發送時丟出例外會變成失敗的結果', async () => {
  const result = await sendToChannel(
    'webhook',
    { title: '測試', content: '內容' },
    { WEBHOOK_URL: 'http://127.0.0.1:1/unreachable' },
  )
  expect(result.channel).toBe('webhook')
  expect(result.success).toBe(false)
  expect(result.error).toBeTruthy()
})
