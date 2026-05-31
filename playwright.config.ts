import { resolve } from 'node:path'
import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const BASE_URL = `https://localhost:${PORT}`

// 與 e2e/seed.ts 的 PERSIST_DIR 一致：wrangler dev（--config dist/...）預設把 KV 持久化到
// manifest 相對路徑，故 serve 與 seed 必須共用同一個 --persist-to 才能讀到同一份種子。
const PERSIST_DIR = resolve('.wrangler/state')

// VERIFIED SERVE COMMAND（Task 1 spike）：build 後以 wrangler dev 透過 HTTPS 服務 Worker，
// 綁定 dist 產物 manifest，並用共用 persist 目錄。CI=1 跳過 wrangler 的互動式 skill 安裝提示。
const serveCommand
  = `CI=1 bunx wrangler dev --config dist/subs_tracker/wrangler.json --port ${PORT} --local-protocol https --persist-to ${PERSIST_DIR}`

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: './e2e/.playwright-output',
  // 比對模式容忍少量抗鋸齒像素差異；快照為平台相關（darwin），CI 需各自產生基準。
  // animations: 'disabled' 凍結 CSS 載入動效（sb-rise 等）至結束狀態，避免截圖時序造成假性 diff。
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    screenshot: 'off',
  },
  // RWD review: capture/assert at both a desktop and a mobile viewport.
  // Mobile uses Pixel 5 (393x851, chromium-native) — iPhone 13 would pull WebKit,
  // which this chromium-only harness does not install (contract-sanctioned alternative).
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: `bun run build && bun run e2e/seed.ts && ${serveCommand}`,
    url: BASE_URL,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
