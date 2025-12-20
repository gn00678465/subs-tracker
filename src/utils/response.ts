/**
 * API 回應工具函數
 * 提供統一的回應格式化方法
 */

import type { Context } from 'hono'
import { ErrorCode } from '../types/error'

/**
 * 成功回應 (200)
 * @param c Hono Context
 * @param data 可選：要回傳的資料
 * @param message 可選：成功訊息
 */
export function success<T>(c: Context, data?: T, message?: string): Response {
  const response: Api.SuccessResponse<T> = { success: true }
  if (data !== undefined)
    response.data = data
  if (message)
    response.message = message
  return c.json(response, 200)
}

/**
 * 創建成功回應 (201)
 * @param c Hono Context
 * @param data 創建的資源資料
 * @param message 可選：成功訊息
 */
export function created<T>(c: Context, data: T, message?: string): Response {
  const response: Api.SuccessResponse<T> = { success: true, data }
  if (message)
    response.message = message
  return c.json(response, 201)
}

/**
 * 驗證錯誤回應 (400)
 * @param c Hono Context
 * @param message 錯誤訊息
 * @param errors 可選：驗證錯誤詳情
 */
export function validationError(
  c: Context,
  message: string,
  errors?: Array<{ path: string, message: string }>,
): Response {
  const response: Api.ErrorResponse = {
    success: false,
    message,
    code: ErrorCode.VALIDATION_ERROR,
  }
  if (errors)
    response.errors = errors
  return c.json(response, 400)
}

/**
 * 認證錯誤回應 (401)
 * @param c Hono Context
 * @param message 錯誤訊息
 */
export function unauthorized(c: Context, message: string): Response {
  return c.json(
    {
      success: false,
      message,
      code: ErrorCode.UNAUTHORIZED,
    } as Api.ErrorResponse,
    401,
  )
}

/**
 * 授權錯誤回應 (403)
 * @param c Hono Context
 * @param message 錯誤訊息
 */
export function forbidden(c: Context, message: string): Response {
  return c.json(
    {
      success: false,
      message,
      code: ErrorCode.FORBIDDEN,
    } as Api.ErrorResponse,
    403,
  )
}

/**
 * 資源不存在回應 (404)
 * @param c Hono Context
 * @param message 錯誤訊息
 */
export function notFound(c: Context, message: string): Response {
  return c.json(
    {
      success: false,
      message,
      code: ErrorCode.NOT_FOUND,
    } as Api.ErrorResponse,
    404,
  )
}

/**
 * 服務器錯誤回應 (500)
 * @param c Hono Context
 * @param message 錯誤訊息（默認值：'服務器內部錯誤，請稍後重試'）
 */
export function serverError(c: Context, message: string = '服務器內部錯誤，請稍後重試'): Response {
  return c.json(
    {
      success: false,
      message,
      code: ErrorCode.INTERNAL_ERROR,
    } as Api.ErrorResponse,
    500,
  )
}

/**
 * 功能未實現回應 (501)
 * @param c Hono Context
 * @param message 錯誤訊息
 */
export function notImplemented(c: Context, message: string): Response {
  return c.json(
    {
      success: false,
      message,
      code: ErrorCode.NOT_IMPLEMENTED,
    } as Api.ErrorResponse,
    501,
  )
}
