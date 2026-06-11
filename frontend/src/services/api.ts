import type { ApiResponse } from '@/types/api'

const API_BASE = '/api'

/** Thrown when the API returns an error envelope or a non-OK HTTP status. */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
}

/**
 * Perform a request against the Kiroku API and unwrap the standard
 * `{ data, error }` envelope. Returns `data` on success; throws `ApiError`
 * on any HTTP error, API error message, or malformed response.
 *
 * A `FormData` body is sent as multipart/form-data (the browser sets the
 * boundary header); anything else is JSON-encoded.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options
  const isFormData = body instanceof FormData

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      signal,
      headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    })
  } catch (cause) {
    throw new ApiError(
      cause instanceof Error ? cause.message : 'Network request failed',
      0,
    )
  }

  // A 204 No Content carries no body to unwrap (e.g. hard-delete endpoints).
  if (response.status === 204) {
    return undefined as T
  }

  let payload: ApiResponse<T>
  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    throw new ApiError('Invalid JSON response from server', response.status)
  }

  if (!response.ok || payload.error !== null) {
    throw new ApiError(
      payload.error ?? `Request failed with status ${response.status}`,
      response.status,
    )
  }

  return payload.data as T
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal): Promise<T> =>
    request<T>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> =>
    request<T>(path, { method: 'POST', body, signal }),
  postForm: <T>(path: string, body: FormData, signal?: AbortSignal): Promise<T> =>
    request<T>(path, { method: 'POST', body, signal }),
  put: <T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> =>
    request<T>(path, { method: 'PUT', body, signal }),
  patch: <T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> =>
    request<T>(path, { method: 'PATCH', body, signal }),
  delete: <T>(path: string, signal?: AbortSignal): Promise<T> =>
    request<T>(path, { method: 'DELETE', signal }),
}
