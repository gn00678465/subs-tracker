import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { getPlatformProxy } from 'wrangler'

const MIGRATIONS_DIR = join(import.meta.dirname, '../../migrations')

function migrationStatements(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .flatMap((file) =>
      readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
        .replace(/--.*$/gm, '')
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean),
    )
}

/** 每次呼叫都是一個套用過全部 migration 的空白本機 D1 */
export async function createTestDb(): Promise<{ db: D1Database; dispose: () => Promise<void> }> {
  const proxy = await getPlatformProxy<{ DB: D1Database }>({ persist: false })
  const db = proxy.env.DB
  await db.batch(migrationStatements().map((sql) => db.prepare(sql)))
  return { db, dispose: proxy.dispose }
}

/** 舊版 KV 的替身：值以 JSON 存入，只支援匯入用到的 get */
export function legacyKv(entries: Record<string, unknown> = {}): KVNamespace {
  const data = new Map(Object.entries(entries).map(([key, value]) => [key, JSON.stringify(value)]))
  return { get: async (key: string) => data.get(key) ?? null } as unknown as KVNamespace
}
