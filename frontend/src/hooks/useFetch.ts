import { useCallback, useEffect, useState, type DependencyList } from 'react'
import { ApiError } from '@/services/api'

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Fetch data on mount and expose loading/error/reload state.
 *
 * The fetcher receives an `AbortSignal`; in-flight requests are aborted when
 * the component unmounts, the dependencies change, or a reload is triggered,
 * so stale responses never overwrite fresh state.
 *
 * Pass `deps` to re-fetch when inputs change (e.g. a selected resolution).
 * Keeping the re-fetch inside the effect means a single cleanup aborts the
 * previous request, avoiding duplicate in-flight requests under StrictMode's
 * double-mount — where a ref-based "skip first render" guard would not survive.
 */
export function useFetch<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: DependencyList = [],
): FetchState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Bumping this re-runs the effect to refetch.
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    setNonce((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetcher(controller.signal)
      .then((result) => {
        // A superseded request (unmount, dep change, reload) is aborted before
        // its promise settles; ignore it so it never overwrites fresh state.
        if (controller.signal.aborted) {
          return
        }
        setData(result)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) {
          return
        }
        setError(cause instanceof ApiError ? cause.message : 'Failed to load data')
        setLoading(false)
      })

    return () => controller.abort()
    // `fetcher` is recreated each render by callers, so re-run on `nonce` (reload)
    // and the caller-provided `deps` only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps])

  return { data, loading, error, reload }
}
