export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

interface Envelope<T> {
  success: boolean
  data?: T
  message?: string
}

function isEnvelope(value: unknown): value is Envelope<unknown> {
  return typeof value === 'object' && value !== null && 'success' in value
}

export function createApi(fetchImpl: typeof fetch) {
  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, signal } = opts
    const headers: Record<string, string> = {}
    const hasBody = body !== undefined
    if (hasBody)
      headers['Content-Type'] = 'application/json'

    const response = await fetchImpl(path, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal,
    })

    let payload: unknown
    try {
      payload = await response.json()
    }
    catch {
      payload = undefined
    }

    if (isEnvelope(payload)) {
      if (!payload.success || !response.ok)
        throw new ApiError(payload.message ?? response.statusText, response.status)
      return payload.data as T
    }

    if (!response.ok)
      throw new ApiError(response.statusText || `HTTP ${response.status}`, response.status)

    return payload as T
  }

  return {
    get: <T>(path: string, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'GET' }),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'POST', body }),
    put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'PUT', body }),
    delete: <T>(path: string, opts?: RequestOptions) =>
      request<T>(path, { ...opts, method: 'DELETE' }),
  }
}

export const api = createApi(globalThis.fetch.bind(globalThis))
