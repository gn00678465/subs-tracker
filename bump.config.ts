import { defineConfig } from 'bumpp'

export default defineConfig({
  files: ['package.json'],
  commit: 'chore(release): bump version to v%s',
  tag: true,
  push: false, // Push manually after changelog generation
  all: false,
})
