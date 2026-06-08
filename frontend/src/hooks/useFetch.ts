import { useCallback, useEffect, useState } from 'react'
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
 * the component unmounts or a reload is triggered, so stale responses never
 * overwrite fresh state.
 */
export function useFetch<T>(fetcher: (signal: AbortSignal) => Promise<T>): FetchState<T> {
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
    // `fetcher` is recreated each render by callers, so depend on `nonce` only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce])

  return { data, loading, error, reload }
}
