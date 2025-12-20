import type { Bindings, Subscription } from '../types'
import * as logger from '../utils/logger'
import { addPeriod, getCurrentTime } from '../utils/time'

/**
 * 訂閱服務模組
 * 處理所有訂閱 CRUD 操作及自動續期邏輯
 */

// ==================== KV Operations ====================

/**
 * 從 KV 獲取所有訂閱
 */
export async function getAllSubscriptions(env: Bindings): Promise<Subscription[]> {
  try {
    const data = await env.SUBSCRIPTIONS_KV.get('subscriptions')
    return data ? JSON.parse(data) : []
  }
  catch (error) {
    logger.error('獲取訂閱列表失敗', error, { prefix: 'Subscription' })
    return []
  }
}

/**
 * 根據 ID 獲取單個訂閱
 */
export async function getSubscription(
  id: string,
  env: Bindings,
): Promise<Subscription | undefined> {
  const subscriptions = await getAllSubscriptions(env)
  return subscriptions.find(s => s.id === id)
}

// ==================== Helper Functions ====================

/**
 * 解析提醒設定
 * 優先級：reminderValue + reminderUnit > reminderDays/reminderHours > 預設 7 天
 */
export function resolveReminderSetting(subscription: Partial<Subscription>): {
  unit: 'day' | 'hour'
  value: number
} {
  // 優先使用明確的 reminderValue + reminderUnit
  if (subscription.reminderValue && subscription.reminderUnit) {
    const value = Number(subscription.reminderValue)
    if (!Number.isNaN(value) && value >= 0) {
      return {
        unit: subscription.reminderUnit,
        value,
      }
    }
  }

  // 回退到舊字段
  if (subscription.reminderDays) {
    const value = Number(subscription.reminderDays)
    if (!Number.isNaN(value) && value >= 0) {
      return { unit: 'day', value }
    }
  }

  if (subscription.reminderHours) {
    const value = Number(subscription.reminderHours)
    if (!Number.isNaN(value) && value >= 0) {
      return { unit: 'hour', value }
    }
  }

  // 預設：7 天
  return { unit: 'day', value: 7 }
}

/**
 * 判斷是否應觸發提醒
 * @param reminder 提醒設定
 * @param daysDiff 距離到期的天數
 * @param hoursDiff 距離到期的小時數
 */
export function shouldTriggerReminder(
  reminder: { unit: 'day' | 'hour', value: number },
  daysDiff: number,
  hoursDiff: number,
): boolean {
  if (reminder.unit === 'hour') {
    // 小時級提醒：hoursDiff 在 0 到 reminderValue 之間
    return hoursDiff >= 0 && hoursDiff <= reminder.value
  }
  else {
    // 天級提醒：daysDiff 在 0 到 reminderValue 之間
    return daysDiff >= 0 && daysDiff <= reminder.value
  }
}

/**
 * 應用自動續期邏輯（僅公曆）
 * @param subscription 訂閱對象
 * @param currentTime 當前時間
 * @returns 是否進行了續期及新到期日期
 */
export function applyAutoRenewal(
  subscription: Subscription,
  currentTime: Date,
): { renewed: boolean, newExpiryDate?: string } {
  if (!subscription.autoRenew || !subscription.periodValue || !subscription.periodUnit) {
    return { renewed: false }
  }

  let expiryDate = new Date(subscription.expiryDate)

  // 如果未過期，無需續期
  if (expiryDate >= currentTime) {
    return { renewed: false }
  }

  // 循環加週期直到未來
  let iterations = 0
  const maxIterations = 1000 // 防止無限循環

  while (expiryDate < currentTime && iterations < maxIterations) {
    expiryDate = addPeriod(expiryDate, subscription.periodValue, subscription.periodUnit)
    iterations++
  }

  if (iterations >= maxIterations) {
    logger.warning(`自動續期循環過多: ${subscription.id}`, { prefix: 'Subscription' })
    return { renewed: false }
  }

  return {
    renewed: true,
    newExpiryDate: expiryDate.toISOString(),
  }
}

// ==================== CRUD Operations ====================

/**
 * 創建新訂閱
 */
export async function createSubscription(
  data: Partial<Subscription>,
  env: Bindings,
): Promise<{ success: boolean, subscription?: Subscription, message?: string }> {
  try {
    // 驗證必填字段
    if (!data.name || !data.expiryDate) {
      return { success: false, message: '缺少必填字段 (name, expiryDate)' }
    }

    const subscriptions = await getAllSubscriptions(env)

    // 解析到期日期（創建時不進行自動續期）
    const expiryDate = new Date(data.expiryDate)

    // 解析提醒設定
    const reminderSetting = resolveReminderSetting(data)

    // 構建新訂閱
    const newSubscription: Subscription = {
      id: Date.now().toString(),
      name: data.name,
      customType: data.customType || '',
      category: data.category ? data.category.trim() : '',
      currency: data.currency,
      price: data.price,
      startDate: data.startDate,
      expiryDate: expiryDate.toISOString(),
      hasEndDate: data.hasEndDate,
      periodValue: data.periodValue || 1,
      periodUnit: data.periodUnit || 'month',
      periodMethod: data.periodMethod,
      website: data.website,
      isFreeTrial: data.isFreeTrial,
      isReminderSet: data.isReminderSet,
      reminderMe: data.reminderMe,
      reminderUnit: reminderSetting.unit,
      reminderValue: reminderSetting.value,
      reminderDays: reminderSetting.unit === 'day' ? reminderSetting.value : undefined,
      reminderHours: reminderSetting.unit === 'hour' ? reminderSetting.value : undefined,
      notes: data.notes || '',
      isActive: data.isActive !== false,
      autoRenew: data.autoRenew !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    subscriptions.push(newSubscription)

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions))

    return { success: true, subscription: newSubscription }
  }
  catch (error) {
    logger.error('創建訂閱失敗', error, { prefix: 'Subscription' })
    return {
      success: false,
      message: error instanceof Error ? error.message : '創建訂閱失敗',
    }
  }
}

/**
 * 更新訂閱
 */
export async function updateSubscription(
  id: string,
  data: Partial<Subscription>,
  env: Bindings,
): Promise<{ success: boolean, subscription?: Subscription, message?: string }> {
  try {
    const subscriptions = await getAllSubscriptions(env)
    const index = subscriptions.findIndex(s => s.id === id)

    if (index === -1) {
      return { success: false, message: '訂閱不存在' }
    }

    // 驗證必填字段
    if (!data.name || !data.expiryDate) {
      return { success: false, message: '缺少必填字段 (name, expiryDate)' }
    }

    // 解析到期日期
    let expiryDate = new Date(data.expiryDate)
    const currentTime = getCurrentTime()

    // 如果到期且有週期設定，自動續期
    if (expiryDate < currentTime && data.periodValue && data.periodUnit) {
      const renewal = applyAutoRenewal(
        { ...data, expiryDate: data.expiryDate } as Subscription,
        currentTime,
      )
      if (renewal.renewed && renewal.newExpiryDate) {
        expiryDate = new Date(renewal.newExpiryDate)
      }
    }

    // 解析提醒設定
    const reminderSetting = resolveReminderSetting(data)

    // 更新訂閱（保留原有字段 + 覆蓋新字段）
    const updatedSubscription: Subscription = {
      ...subscriptions[index],
      name: data.name,
      customType: data.customType || '',
      category: data.category ? data.category.trim() : '',
      currency: data.currency ?? subscriptions[index].currency,
      price: data.price ?? subscriptions[index].price,
      startDate: data.startDate ?? subscriptions[index].startDate,
      expiryDate: expiryDate.toISOString(),
      hasEndDate: data.hasEndDate ?? subscriptions[index].hasEndDate,
      periodValue: data.periodValue ?? subscriptions[index].periodValue,
      periodUnit: data.periodUnit ?? subscriptions[index].periodUnit,
      periodMethod: data.periodMethod ?? subscriptions[index].periodMethod,
      website: data.website ?? subscriptions[index].website,
      isFreeTrial: data.isFreeTrial ?? subscriptions[index].isFreeTrial,
      isReminderSet: data.isReminderSet ?? subscriptions[index].isReminderSet,
      reminderMe: data.reminderMe ?? subscriptions[index].reminderMe,
      reminderUnit: reminderSetting.unit,
      reminderValue: reminderSetting.value,
      reminderDays: reminderSetting.unit === 'day' ? reminderSetting.value : undefined,
      reminderHours: reminderSetting.unit === 'hour' ? reminderSetting.value : undefined,
      notes: data.notes ?? subscriptions[index].notes,
      isActive: data.isActive ?? subscriptions[index].isActive,
      autoRenew: data.autoRenew ?? subscriptions[index].autoRenew,
      updatedAt: new Date().toISOString(),
    }

    subscriptions[index] = updatedSubscription

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions))

    return { success: true, subscription: updatedSubscription }
  }
  catch (error) {
    logger.error('更新訂閱失敗', error, { prefix: 'Subscription' })
    return {
      success: false,
      message: error instanceof Error ? error.message : '更新訂閱失敗',
    }
  }
}

/**
 * 刪除訂閱
 */
export async function deleteSubscription(
  id: string,
  env: Bindings,
): Promise<{ success: boolean, message?: string }> {
  try {
    const subscriptions = await getAllSubscriptions(env)
    const index = subscriptions.findIndex(s => s.id === id)

    if (index === -1) {
      return { success: false, message: '訂閱不存在' }
    }

    subscriptions.splice(index, 1)

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions))

    return { success: true }
  }
  catch (error) {
    logger.error('刪除訂閱失敗', error, { prefix: 'Subscription' })
    return {
      success: false,
      message: error instanceof Error ? error.message : '刪除訂閱失敗',
    }
  }
}

/**
 * 切換訂閱啟用/停用狀態
 */
export async function toggleSubscriptionStatus(
  id: string,
  isActive: boolean,
  env: Bindings,
): Promise<{ success: boolean, subscription?: Subscription, message?: string }> {
  try {
    const subscriptions = await getAllSubscriptions(env)
    const index = subscriptions.findIndex(s => s.id === id)

    if (index === -1) {
      return { success: false, message: '訂閱不存在' }
    }

    subscriptions[index].isActive = isActive
    subscriptions[index].updatedAt = new Date().toISOString()

    await env.SUBSCRIPTIONS_KV.put('subscriptions', JSON.stringify(subscriptions))

    return { success: true, subscription: subscriptions[index] }
  }
  catch (error) {
    logger.error('切換狀態失敗', error, { prefix: 'Subscription' })
    return {
      success: false,
      message: error instanceof Error ? error.message : '切換狀態失敗',
    }
  }
}
