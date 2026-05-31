import { defineConfig } from 'vitest/config'

export default defineConfig({
  // client 元件以 hono/jsx/dom 渲染；測試環境統一此 JSX runtime
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'hono/jsx/dom',
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'src/client/lib/**',
        'src/utils/formAdaptor.ts',
        'src/services/subscription_cron.ts',
      ],
      // AGENTS.md → Refactor Harness 的 definition of done：上列每個檔案皆 ≥ 80%。
      // perFile 讓任一檔案掉到 80% 以下時 `bun run test:coverage` 直接 exit 1（真正的 gate）。
      thresholds: {
        perFile: true,
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
})
