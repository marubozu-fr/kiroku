/**
 * Standard envelope returned by every Kiroku API endpoint.
 *
 * Success: `{ data, error: null }`
 * Failure: `{ data: null, error: "message" }`
 */
export interface ApiResponse<T> {
  data: T | null
  error: string | null
}
