import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '@/services/api'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('api request — abort handling', () => {
  it('re-throws an AbortError unwrapped so callers can detect it by name', async () => {
    // Simulate a fetch cancelled by an AbortController (e.g. StrictMode cleanup).
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new DOMException('signal is aborted without reason', 'AbortError'),
    )

    const err = await api.get('/news/status').catch((e: unknown) => e)

    expect(err).toBeInstanceOf(DOMException)
    expect((err as DOMException).name).toBe('AbortError')
    expect(err).not.toBeInstanceOf(ApiError)
  })

  it('wraps a genuine network failure in ApiError with status 0', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    const err = await api.get('/news/status').catch((e: unknown) => e)

    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(0)
    expect((err as ApiError).message).toBe('Failed to fetch')
  })
})
