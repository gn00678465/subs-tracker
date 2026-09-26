import { deleteSubscriptionRow, findSubscription, insertSubscription, saveUserFields } from '../db/subscriptions'
import type { Bindings, Subscription } from '../types'
import type { CalendarDate } from '../utils/calendarDate'
import { addPeriod } from '../utils/calendarDate'

export { findSubscription, listSubscriptions } from '../db/subscriptions'

export type SubscriptionInput = Omit<
  Subscription,
  'id' | 'createdAt' | 'updatedAt' | 'lastReminderSentAt' | 'lastCheckedExpiryDate'
>

// 試用結束後轉為付費；取消期限只屬於原本那一期
function advance(subscription: Subscription, expiryDate: CalendarDate): Subscription {
  return { ...subscription, expiryDate, isFreeTrial: false, cancelByDate: undefined }
}

/**
 * 自動續訂的訂閱，把已過去的扣款日依付款週期推進到今天或之後。
 * 手動續訂的訂閱不推進，維持「已過期」，等使用者按「已續訂」。
 */
export function rollForward(subscription: Subscription, today: CalendarDate): Subscription {
  if (!subscription.autoRenew || subscription.expiryDate >= today) return subscription

  let expiryDate = subscription.expiryDate
  // 上限防止壞資料造成無窮迴圈；每天一期也涵蓋超過 27 年
  for (let i = 0; expiryDate < today; i++) {
    if (i >= 10_000) throw new Error(`推進扣款日次數過多：${subscription.id}`)
    expiryDate = addPeriod(expiryDate, subscription.periodValue, subscription.periodUnit)
  }
  return advance(subscription, expiryDate)
}

export async function createSubscription(input: SubscriptionInput, env: Bindings): Promise<Subscription> {
  const now = new Date().toISOString()
  const subscription: Subscription = {
    ...input,
    id: crypto.randomUUID(),
    name: input.name.trim(),
    category: input.category.trim(),
    paymentMethod: input.paymentMethod.trim(),
    createdAt: now,
    updatedAt: now,
  }
  await insertSubscription(env.DB, subscription).run()
  return subscription
}

/** 填了已過去的扣款日時，自動續訂的訂閱依週期推進到下一個日期；訂閱不存在時回傳 null */
export async function updateSubscription(
  id: string,
  patch: Partial<SubscriptionInput>,
  today: CalendarDate,
  env: Bindings,
): Promise<Subscription | null> {
  const current = await findSubscription(env.DB, id)
  if (!current) return null
  const merged: Subscription = { ...current, ...patch, id, updatedAt: new Date().toISOString() }
  return saveUserFields(env.DB, rollForward(merged, today))
}

/** 「已續訂」：下次扣款日推進一個週期 */
export async function renewSubscription(id: string, env: Bindings): Promise<Subscription | null> {
  const current = await findSubscription(env.DB, id)
  if (!current) return null
  const renewed = advance(current, addPeriod(current.expiryDate, current.periodValue, current.periodUnit))
  return saveUserFields(env.DB, { ...renewed, updatedAt: new Date().toISOString() })
}

export async function deleteSubscription(id: string, env: Bindings): Promise<boolean> {
  return deleteSubscriptionRow(env.DB, id)
}
