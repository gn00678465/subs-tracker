import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { ADMIN_PASSWORD, ADMIN_USERNAME } from './constants'

// 與 playwright.config.ts 的 serve 指令共用同一個 --persist-to 目錄，否則
// wrangler dev（--config dist/...）會把 KV 持久化到 manifest 相對路徑、讀不到種子。
const PERSIST_DIR = resolve('.wrangler/state')

const config = {
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  TIMEZONE: 'Asia/Taipei',
  NOTIFICATION_HOURS: [],
  ENABLED_NOTIFIERS: [],
  REMINDER_MODE: 'ONCE',
}

const subscriptions = [
  {
    id: '1767225600000',
    name: 'Netflix',
    category: '影音串流',
    currency: 'TWD',
    price: '390',
    startDate: '2026-01-01',
    expiryDate: '2026-06-10',
    hasEndDate: false,
    autoRenew: true,
    isFreeTrial: false,
    periodValue: 1,
    periodUnit: 'month',
    periodMethod: 'credit',
    website: 'https://www.netflix.com',
    isReminderSet: true,
    reminderMe: 7,
    notes: '家庭方案',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '1771113600000',
    name: 'Spotify',
    category: '影音串流',
    currency: 'TWD',
    price: '149',
    startDate: '2026-02-15',
    expiryDate: '2026-12-15',
    hasEndDate: false,
    autoRenew: true,
    isFreeTrial: false,
    periodValue: 1,
    periodUnit: 'month',
    periodMethod: 'apple',
    website: 'https://www.spotify.com',
    isReminderSet: true,
    reminderMe: 3,
    notes: '',
    isActive: true,
    createdAt: '2026-02-15T00:00:00.000Z',
    updatedAt: '2026-02-15T00:00:00.000Z',
  },
  {
    id: '1764547200000',
    name: 'iCloud+',
    category: '雲端儲存',
    currency: 'TWD',
    price: '90',
    startDate: '2025-12-01',
    expiryDate: '2026-06-01',
    hasEndDate: false,
    autoRenew: false,
    isFreeTrial: false,
    periodValue: 1,
    periodUnit: 'year',
    periodMethod: 'apple',
    website: 'https://www.icloud.com',
    isReminderSet: false,
    reminderMe: 14,
    notes: '已停用範例',
    isActive: false,
    createdAt: '2025-12-01T00:00:00.000Z',
    updatedAt: '2025-12-01T00:00:00.000Z',
  },
]

// SUBSCRIPTIONS_KV 同時設定 id 與 preview_id，故 put 需指定 --preview / --preview false；
// 本機 wrangler dev 讀 preview 命名空間，兩者皆寫入以確保命中。
function kvPut(key: string, value: unknown): void {
  for (const previewFlag of [['--preview'], ['--preview', 'false']]) {
    const result = spawnSync(
      'bunx',
      [
        'wrangler',
        'kv',
        'key',
        'put',
        '--local',
        '--persist-to',
        PERSIST_DIR,
        ...previewFlag,
        '--binding',
        'SUBSCRIPTIONS_KV',
        key,
        JSON.stringify(value),
      ],
      { stdio: 'inherit' },
    )
    if (result.status !== 0) {
      throw new Error(`seed kv put failed for key "${key}" ${previewFlag.join(' ')} (exit ${result.status})`)
    }
  }
}

export function seed(): void {
  kvPut('config', config)
  kvPut('subscriptions', subscriptions)
  console.warn('[seed] config + subscriptions written to local KV')
}

// 僅在以 `bun run e2e/seed.ts` 直接執行時種子；被 import 時不寫入 KV，
// 避免 webServer 指令與測試端各種一次（重複寫 local KV）。
if (import.meta.main) {
  seed()
}
