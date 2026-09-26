import { defineConfig } from 'bumpp'

export default defineConfig({
  files: ['package.json'],
  commit: 'chore(release): bump version to v%s',
  tag: true,
  // changelog 要在建立 tag 前產生：tag 建立後，範圍「最新 tag..HEAD」沒有 commit，輸出是空的（issue #10）
  execute: 'bun run changelog',
  all: true,
  push: true,
})
