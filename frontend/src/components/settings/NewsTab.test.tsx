import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { NewsTab } from '@/components/settings/NewsTab'
import type { Preferences } from '@/types/preferences'
import { jsonResponse, renderWithProviders } from '@/test/utils'

function preferences(overrides: Partial<Preferences> = {}): Preferences {
  return {
    risk_per_trade_default: 1,
    news_enabled: true,
    news_currencies: ['USD', 'EUR'],
    news_min_impact: 'MEDIUM',
    backup_directory: null,
    backup_reminder_days: 7,
    last_backup_at: null,
    ...overrides,
  }
}

/**
 * Route the mocked fetch by path + method. Each handler returns a Response so
 * the component's two initial loads (preferences + status) resolve as in prod.
 */
function stubFetch(
  handlers: {
    prefs?: Preferences
    status?: { last_sync: string | null; is_stale: boolean }
    onPatch?: (body: unknown) => void
  } = {},
) {
  const {
    prefs = preferences(),
    status = { last_sync: null, is_stale: false },
    onPatch,
  } = handlers
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url === '/api/preferences' && method === 'GET') {
      return jsonResponse(prefs)
    }
    if (url === '/api/preferences' && method === 'PATCH') {
      onPatch?.(JSON.parse(init?.body as string))
      return jsonResponse(prefs)
    }
    if (url === '/api/news/status') {
      return jsonResponse(status)
    }
    throw new Error(`Unexpected request: ${method} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await i18n.changeLanguage('en')
})

/**
 * The fetched preferences seed the controls in an effect one tick after the
 * data loads. Wait for the (enabled) master switch to settle before driving
 * controls whose behaviour depends on that seeded state.
 */
async function waitForChecked(): Promise<HTMLElement> {
  const toggle = screen.getByRole('switch')
  await waitFor(() => expect(toggle).toBeChecked())
  return toggle
}

describe('NewsTab', () => {
  it('renders preferences from the API', async () => {
    stubFetch()
    renderWithProviders(<NewsTab />)

    expect(await screen.findByText('Economic news')).toBeInTheDocument()
    // The fetched preferences seed the controls one tick after the data loads,
    // so wait for the master switch to reflect news_enabled = true.
    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeChecked()
    })
    // Stored currencies are checked; others are not.
    expect(screen.getByRole('checkbox', { name: 'USD' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'EUR' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'GBP' })).not.toBeChecked()
    // Minimum impact = MEDIUM maps to the "High + Medium" segment.
    expect(screen.getByRole('radio', { name: 'High + Medium' })).toBeChecked()
  })

  it('disables dependent controls when news is turned off', async () => {
    stubFetch({ prefs: preferences({ news_enabled: false }) })
    renderWithProviders(<NewsTab />)

    await screen.findByText('Economic news')
    expect(screen.getByRole('switch')).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'USD' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'All' })).toBeDisabled()
  })

  it('persists a toggle change via PATCH /api/preferences', async () => {
    const onPatch = vi.fn()
    stubFetch({ onPatch })
    renderWithProviders(<NewsTab />)

    await screen.findByText('Economic news')
    const toggle = await waitForChecked()
    fireEvent.click(toggle)

    await waitFor(() => {
      expect(onPatch).toHaveBeenCalledWith({ news_enabled: false })
    })
  })

  it('selects all currencies via the "Select all" helper', async () => {
    const onPatch = vi.fn()
    stubFetch({ onPatch })
    renderWithProviders(<NewsTab />)

    await screen.findByText('Economic news')
    await waitForChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))

    await waitFor(() => {
      expect(onPatch).toHaveBeenCalledWith({
        news_currencies: ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'NZD', 'CNY'],
      })
    })
  })

  it('shows "Never synced" when there is no last sync', async () => {
    stubFetch({ status: { last_sync: null, is_stale: false } })
    renderWithProviders(<NewsTab />)

    expect(await screen.findByText('Never synced')).toBeInTheDocument()
  })

  it('reverts the toggle and warns when the save fails', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      if (url === '/api/preferences' && method === 'GET') {
        return jsonResponse(preferences())
      }
      if (url === '/api/news/status') {
        return jsonResponse({ last_sync: null, is_stale: false })
      }
      if (url === '/api/preferences' && method === 'PATCH') {
        return jsonResponse(null, { ok: false, status: 500, error: 'boom' })
      }
      throw new Error(`Unexpected request: ${method} ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<NewsTab />)

    await screen.findByText('Economic news')
    const toggle = await waitForChecked()
    fireEvent.click(toggle)

    // The switch flips off optimistically, then rolls back once the PATCH rejects.
    expect(toggle).not.toBeChecked()
    await waitFor(() => {
      expect(toggle).toBeChecked()
    })
  })
})
