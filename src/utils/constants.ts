// 貨幣選項
export const currencies = [
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
export const periodUnits = [
  { value: 'day', label: '每天' },
  { value: 'month', label: '每月' },
  { value: 'year', label: '每年' },
] as const

// 付款方式選項
export const periodMethods = [
  { value: 'credit', label: '信用卡' },
  { value: 'apple', label: 'Apple Pay' },
  { value: 'google', label: 'Google Pay' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'other', label: '其他' },
] as const

// 提醒時間選項
export const reminderOptions = [
  { value: '1', label: '前一天' },
  { value: '3', label: '3天前' },
  { value: '7', label: '1周前' },
  { value: '14', label: '2周前' },
  { value: '21', label: '3周前' },
  { value: '30', label: '1個月前' },
  { value: '60', label: '2個月前' },
  { value: '90', label: '3個月前' },
] as const
