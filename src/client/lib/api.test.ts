import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, createApi } from './api'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('apiError', () => {
  it('帶有 message、status 與 name', () => {
    const err = new ApiError('壞掉了', 500)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('壞掉了')
    expect(err.status).toBe(500)
    expect(err.name).toBe('ApiError')
  })
})

describe('createApi', () => {
  let fetchImpl: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchImpl = vi.fn()
  })

  it('get 成功時回傳 envelope 內的 data', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: true, data: [{ id: '1' }] }))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    const result = await api.get<{ id: string }[]>('/api/subscriptions')

    expect(result).toEqual([{ id: '1' }])
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/subscriptions')
    expect(init?.method).toBe('GET')
    expect(init?.body).toBeUndefined()
  })

  it('當 envelope 無 data 時回傳 undefined', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: true }))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    const result = await api.get<undefined>('/api/ping')

    expect(result).toBeUndefined()
  })

  it('success === false 時丟出 ApiError 含 message 與 status', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: false, message: '驗證失敗' }, 400))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    await expect(api.get('/api/subscriptions')).rejects.toMatchObject({
      name: 'ApiError',
      message: '驗證失敗',
      status: 400,
    })
  })

  it('回應為 HTTP 非 2xx 但 body 非 envelope 時，以狀態文字丟出 ApiError', async () => {
    fetchImpl.mockResolvedValue(new Response('Internal Server Error', { status: 500 }))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    await expect(api.get('/api/boom')).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
    })
  })

  it('200 但 success === false 也丟出 ApiError', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: false, message: '不允許' }, 200))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    await expect(api.get('/api/x')).rejects.toMatchObject({
      message: '不允許',
      status: 200,
    })
  })

  it('post 帶 JSON body 與 Content-Type header', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: true, data: { id: '9' } }, 201))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    const result = await api.post<{ id: string }>('/api/subscriptions', { name: 'Netflix' })

    expect(result).toEqual({ id: '9' })
    const [, init] = fetchImpl.mock.calls[0]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(JSON.stringify({ name: 'Netflix' }))
    expect(new Headers(init?.headers).get('Content-Type')).toBe('application/json')
  })

  it('put 帶 JSON body', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: true, data: { isActive: false } }))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    await api.put('/api/subscriptions/1', { isActive: false })

    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/subscriptions/1')
    expect(init?.method).toBe('PUT')
    expect(init?.body).toBe(JSON.stringify({ isActive: false }))
  })

  it('delete 不帶 body 也不帶 Content-Type', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: true }))
    const api = createApi(fetchImpl as unknown as typeof fetch)

    await api.delete('/api/subscriptions/1')

    const [, init] = fetchImpl.mock.calls[0]
    expect(init?.method).toBe('DELETE')
    expect(init?.body).toBeUndefined()
    expect(new Headers(init?.headers).get('Content-Type')).toBeNull()
  })

  it('透傳 AbortSignal', async () => {
    fetchImpl.mockResolvedValue(jsonResponse({ success: true, data: null }))
    const api = createApi(fetchImpl as unknown as typeof fetch)
    const controller = new AbortController()

    await api.get('/api/subscriptions', { signal: controller.signal })

    const [, init] = fetchImpl.mock.calls[0]
    expect(init?.signal).toBe(controller.signal)
  })
})
