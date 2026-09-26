import { afterAll, beforeAll, expect, test } from 'bun:test'

import { createTestDb } from './d1'

let db: D1Database
let dispose: () => Promise<void>

beforeAll(async () => {
  ;({ db, dispose } = await createTestDb())
})
afterAll(() => dispose())

const insertSubscription = (reminderKind: string, reminderDays: number | null) =>
  db
    .prepare(
      `INSERT INTO subscriptions (id, name, currency, price, period_value, period_unit, expiry_date, auto_renew, reminder_kind, reminder_days, created_at, updated_at)
       VALUES (?, 'x', 'TWD', 1, 1, 'month', '2026-10-01', 1, ?, ?, '', '')`,
    )
    .bind(crypto.randomUUID(), reminderKind, reminderDays)
    .run()

test('settings allows exactly one row', async () => {
  const insert = (id: number) =>
    db
      .prepare(
        `INSERT INTO settings (id, admin_username, admin_password_hash, jwt_secret, reminder_hour, updated_at) VALUES (?, 'a', 'h', 's', 9, '')`,
      )
      .bind(id)
      .run()
  await insert(1)
  await expect(insert(2)).rejects.toThrow()
})

test('reminder_days is set exactly when reminder_kind is days', async () => {
  await insertSubscription('days', 7)
  await insertSubscription('default', null)
  await expect(insertSubscription('days', null)).rejects.toThrow()
  await expect(insertSubscription('off', 3)).rejects.toThrow()
})
