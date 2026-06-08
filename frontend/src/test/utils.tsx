import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'

/** Render a component inside the providers it needs in tests. */
export function renderWithProviders(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

interface FetchResponseOptions {
  ok?: boolean
  status?: number
  error?: string | null
}

/**
 * Build a minimal `Response`-like object matching the Kiroku API envelope,
 * for use with a mocked `fetch`.
 */
export function jsonResponse<T>(
  data: T,
  { ok = true, status = 200, error = null }: FetchResponseOptions = {},
): Response {
  return {
    ok,
    status,
    json: async () => ({ data, error }),
  } as Response
}
