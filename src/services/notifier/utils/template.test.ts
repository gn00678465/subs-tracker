import { expect, test } from 'bun:test'

import { renderTemplate } from './template'

test('變數原樣填入 JSON 字串', () => {
  const title = 'Spotify Premium 4 天後扣款'
  const content = '「A"B」\\ $& 換行\n\tTab'
  const result = renderTemplate('{"title": "{{title}}", "content": "{{content}}"}', {
    title,
    content,
    timestamp: '2026-09-26',
  })
  expect(result.success).toBe(true)
  expect(JSON.parse(result.rendered ?? '')).toEqual({ title, content })
})
