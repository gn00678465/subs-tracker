export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly fieldErrors: { path: string; message: string }[] = [],
  ) {
    super(message)
  }
}

export interface Loaded<T> {
  data: T
  /** 離線時 service worker 回傳快取，並附上快取的時間 */
  cachedAt: string | null
}

export async function api<T = undefined>(method: string, path: string, body?: unknown): Promise<Loaded<T>> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError('無法連線，請確認網路後再試一次。', 0)
  }
  if (response.status === 401) {
    location.assign('/')
    throw new ApiError('登入已過期，請重新登入。', 401)
  }
  const json = (await response.json()) as Api.Response<T>
  if (!json.success) throw new ApiError(json.message, response.status, json.code, json.errors)
  return { data: json.data as T, cachedAt: response.headers.get('X-Cached-At') }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 使用者關閉 passkey 對話框，或另一個 passkey 請求取代了這一個；不當作錯誤 */
export const isCancel = (error: unknown) =>
  error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'AbortError')
