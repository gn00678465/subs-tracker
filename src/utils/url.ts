/**
 * 驗證重定向 URL 是否安全（防止 Open Redirect 漏洞）
 * 只允許相對路徑，且不允許以 // 開頭
 */
export function getSafeRedirectUrl(url: string | null, defaultUrl = '/admin'): string {
  if (!url) {
    return defaultUrl
  }

  // 檢查是否為相對路徑且不以 // 開頭
  // 這可以防止重定向到外部域名，例如 //evil.com
  if (url.startsWith('/') && !url.startsWith('//')) {
    return url
  }

  // 如果不是安全的相對路徑，返回預設路徑
  return defaultUrl
}
