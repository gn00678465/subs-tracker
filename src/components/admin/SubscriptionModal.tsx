export function SubscriptionModal() {
  // 貨幣選項
  const currencies = [
    { code: 'USD', name: '美元', symbol: '$' },
    { code: 'EUR', name: '歐元', symbol: '€' },
    { code: 'GBP', name: '英鎊', symbol: '£' },
    { code: 'JPY', name: '日圓', symbol: '¥' },
    { code: 'CNY', name: '人民幣', symbol: '¥' },
    { code: 'TWD', name: '新台幣', symbol: 'NT$' },
    { code: 'HKD', name: '港幣', symbol: 'HK$' },
    { code: 'KRW', name: '韓元', symbol: '₩' },
    { code: 'SGD', name: '新加坡元', symbol: 'S$' },
    { code: 'AUD', name: '澳幣', symbol: 'A$' },
    { code: 'CAD', name: '加幣', symbol: 'C$' },
    { code: 'CHF', name: '瑞士法郎', symbol: 'CHF' },
    { code: 'SEK', name: '瑞典克朗', symbol: 'kr' },
    { code: 'NZD', name: '紐幣', symbol: 'NZ$' },
  ] as const

  // 付款週期選項
  const periodUnits = [
    { value: 'day', label: '每天' },
    { value: 'month', label: '每月' },
    { value: 'year', label: '每年' },
  ] as const

  // 付款方式選項
  const periodMethods = [
    { value: 'credit', label: '信用卡' },
    { value: 'apple', label: 'Apple Pay' },
    { value: 'google', label: 'Google Pay' },
    { value: 'paypal', label: 'PayPal' },
    { value: 'other', label: '其他' },
  ] as const

  // 提醒時間選項
  const reminderOptions = [
    { value: '1', label: '前一天' },
    { value: '3', label: '3天前' },
    { value: '7', label: '1周前' },
    { value: '14', label: '2周前' },
    { value: '21', label: '3周前' },
    { value: '30', label: '1個月前' },
    { value: '60', label: '2個月前' },
    { value: '90', label: '3個月前' },
  ] as const

  return (
    <>
      <dialog id="subscriptionModal" class="modal">
        <div class="modal-box w-11/12 max-w-3xl max-h-[90vh] overflow-y-auto">
          {/* 頭部 - 標題與關閉按鈕 */}
          <div class="flex items-center justify-between mb-6">
            <h3 id="modalTitle" class="font-bold text-lg">添加新訂閱</h3>
            <form method="dialog">
              <button class="btn btn-sm btn-circle btn-ghost">✕</button>
            </form>
          </div>

          <form id="subscriptionForm" class="space-y-6" hx-post="/api/subscriptions" hx-swap="none">
            <input type="hidden" id="subscriptionId" name="id" />

            {/* 基本資訊 */}
            <fieldset class="space-y-4 fieldset">
              <div class="divider divider-start">基本資訊</div>

              <div class="grid grid-cols-1 gap-4">
                <label class="w-full">
                  <div class="label">
                    <span class="label-text">訂閱名稱 *</span>
                  </div>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    class="input input-bordered w-full"
                    placeholder="輸入訂閱名稱"
                  />
                </label>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label class="w-full">
                    <div class="label">
                      <span class="label-text">訂閱類型</span>
                    </div>
                    <input
                      type="text"
                      id="customType"
                      name="customType"
                      placeholder="例: 串流媒體"
                      class="input input-bordered w-full"
                    />
                  </label>

                  <label class="w-full">
                    <div class="label">
                      <span class="label-text">分類標籤</span>
                    </div>
                    <input
                      type="text"
                      id="category"
                      name="category"
                      placeholder="例: 個人、家庭"
                      class="input input-bordered w-full"
                    />
                  </label>
                </div>
              </div>
            </fieldset>

            {/* 費用設定 */}
            <fieldset class="space-y-4 fieldset">
              <div class="divider divider-start">費用設定</div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label class="w-full">
                  <div class="label">
                    <span class="label-text">預設貨幣</span>
                  </div>
                  <select id="currency" name="currency" class="select select-bordered w-full">
                    {currencies.map(cur => (
                      <option value={cur.code} selected={cur.code === 'TWD'} title={cur.name}>
                        {cur.symbol}
                        {' '}
                        {cur.code}
                      </option>
                    ))}
                  </select>
                </label>

                <label class="w-full">
                  <div class="label">
                    <span class="label-text">訂閱價格 *</span>
                  </div>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    required
                    class="input input-bordered w-full"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </label>
              </div>

              <div class="form-control">
                <label class="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    id="isFreeTrial"
                    name="isFreeTrial"
                    class="checkbox checkbox-primary"
                  />
                  <span class="label-text">是否有免費試用</span>
                </label>
              </div>
            </fieldset>

            {/* 訂閱週期 */}
            <div class="space-y-4 fieldset">
              <div class="divider divider-start">訂閱週期</div>

              <div class="form-control">
                <label class="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    id="hasEndDate"
                    name="hasEndDate"
                    checked
                    class="checkbox checkbox-primary"
                  />
                  <span class="label-text">續訂/終止日期</span>
                </label>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label class="w-full">
                  <div class="label">
                    <span class="label-text">開始日期</span>
                  </div>
                  <input
                    type="date"
                    id="startDate"
                    name="startDate"
                    class="input input-bordered w-full"
                    min="1900-01-01"
                    max="2100-12-31"
                  />
                </label>

                <label id="expiryDateField" class="w-full">
                  <div class="label">
                    <span class="label-text">到期日期 *</span>
                  </div>
                  <input
                    type="date"
                    id="expiryDate"
                    name="expiryDate"
                    required
                    class="input input-bordered w-full"
                    min="1900-01-01"
                    max="2100-12-31"
                  />
                </label>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="form-control">
                  <label class="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      id="isActive"
                      name="isActive"
                      checked
                      class="checkbox checkbox-primary"
                    />
                    <span class="label-text">啟用訂閱</span>
                  </label>
                </div>

                <div class="form-control">
                  <label class="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      id="autoRenew"
                      name="autoRenew"
                      checked
                      class="checkbox checkbox-primary"
                    />
                    <span class="label-text">自動續訂</span>
                  </label>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label class="w-full">
                  <div class="label">
                    <span class="label-text">付款週期</span>
                  </div>
                  <select id="periodUnit" name="periodUnit" class="select select-bordered w-full">
                    {periodUnits.map(unit => (
                      <option value={unit.value} selected={unit.value === 'month'}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label class="w-full">
                  <div class="label">
                    <span class="label-text">頻率</span>
                  </div>
                  <input
                    type="number"
                    class="input input-bordered w-full"
                    id="periodValue"
                    name="periodValue"
                    required
                    min="1"
                    value="1"
                  />
                </label>
              </div>

              <label class="w-full">
                <div class="label">
                  <span class="label-text">付款方式</span>
                </div>
                <select id="periodMethod" name="periodMethod" class="select select-bordered w-full">
                  {periodMethods.map(method => (
                    <option value={method.value} selected={method.value === 'credit'}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* 其他設定 */}
            <fieldset class="space-y-4 fieldset">
              <div class="divider divider-start">其他設定</div>

              <label class="w-full">
                <div class="label">
                  <span class="label-text">網站</span>
                  <span class="label-text-alt text-xs opacity-70">Optional</span>
                </div>
                <input
                  type="text"
                  id="website"
                  name="website"
                  class="input input-bordered w-full"
                  placeholder="https://url.com"
                />
              </label>

              <div class="space-y-4">
                <label class="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    id="isReminderSet"
                    name="isReminderSet"
                    checked
                    class="checkbox checkbox-primary"
                  />
                  <span class="label-text">設定提醒</span>
                </label>
              </div>

              <label class="w-full">
                <div class="label">
                  <span class="label-text">提醒我</span>
                </div>
                <select id="reminderMe" name="reminderMe" class="select select-bordered w-full">
                  {reminderOptions.map(option => (
                    <option value={option.value} selected={option.value === '1'}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label class="w-full">
                <div class="label">
                  <span class="label-text">備註</span>
                </div>
                <textarea
                  id="notes"
                  name="notes"
                  placeholder="添加備註信息..."
                  class="textarea textarea-bordered h-24 w-full"
                >
                </textarea>
              </label>
            </fieldset>

            {/* 提交按鈕 */}
            <div class="flex justify-end gap-3 pt-4">
              <button type="button" id="cancelBtn" class="btn btn-ghost">取消</button>
              <button type="submit" class="btn btn-primary">
                <span id="submitText">保存</span>
                <span id="submitLoading" class="loading loading-spinner loading-sm hidden"></span>
              </button>
            </div>
          </form>
        </div>

        {/* 模態框背景 */}
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  )
}
