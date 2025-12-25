/**
 * API 回應類型定義
 * 統一所有 API 端點的回傳格式
 */

declare namespace Api {
  /**
   * 標準 API 成功回應
   */
  interface SuccessResponse<T = any> {
    success: true
    data?: T // 可選：實際資料
    message?: string // 可選：成功訊息（如 "創建成功"）
  }

  /**
   * 標準 API 錯誤回應
   */
  interface ErrorResponse {
    success: false
    message: string // 必需：錯誤訊息
    errors?: Array<{
    // 可選：驗證錯誤詳情
      path: string
      message: string
    }>
    code?: string // 可選：錯誤代碼（如 "NOT_FOUND", "VALIDATION_ERROR"）
  }

  /**
   * 通用 API 回應
   */
  type Response<T = any> = SuccessResponse<T> | ErrorResponse

  type ErrorCodeType = typeof ErrorCode[keyof typeof ErrorCode]

}
