import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { notifications } from '@mantine/notifications'
import i18n from '@/i18n'
import { ChartsTab } from '@/components/settings/ChartsTab'
import type { Preferences } from '@/types/preferences'
import type { TickerSearchResult } from '@/types/massive'
import { jsonResponse, renderWithProviders } from '@/test/utils'

function preferences(overrides: Partial<Preferences> = {}): Preferences {
  return {
    risk_per_trade_default: 1,
    news_enabled: true,
    news_currencies: ['USD'],
    news_min_impact: 'MEDIUM',
    backup_directory: null,
    backup_reminder_days: 7,
    last_backup_at: null,
    massive_api_key: '',
    chart_timeframes_default: [],
    entry_timeframe_unit_default: null,
    entry_timeframe_value_default: null,
    chart_timeframes_warning_threshold: 8,
    ...overrides,
  }
}

function stubFetch(
  handlers: {
    prefs?: Preferences
    onPatch?: (body: unknown) => void
    tickers?: TickerSearchResult[]
  } = {},
) {
  const { prefs = preferences(), onPatch, tickers = [] } = handlers
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url === '/api/preferences' && method === 'GET') {
      return jsonResponse(prefs)
    }
    if (url === '/api/preferences' && method === 'PATCH') {
      onPatch?.(JSON.parse(init?.body as string))
      return jsonResponse(prefs)
    }
    if ((url as string).startsWith('/api/massive/tickers') && method === 'GET') {
      return jsonResponse(tickers)
    }
    throw new Error(`Unexpected request: ${method} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await i18n.changeLanguage('en')
})

describe('ChartsTab', () => {
  it('renders the API key field', async () => {
    stubFetch()
    renderWithProviders(<ChartsTab />)

    expect(await screen.findByLabelText('Massive API Key')).toBeInTheDocument()
  })

  it('renders the Data Provider title', async () => {
    stubFetch()
    renderWithProviders(<ChartsTab />)

    expect(await screen.findByText('Data Provider')).toBeInTheDocument()
  })

  it('renders the chart timeframes card title', async () => {
    stubFetch()
    renderWithProviders(<ChartsTab />)

    expect(await screen.findByText('Chart Timeframes')).toBeInTheDocument()
  })

  it('seeds the API key from stored preferences', async () => {
    stubFetch({ prefs: preferences({ massive_api_key: 'my-key' }) })
    renderWithProviders(<ChartsTab />)

    const input = await screen.findByLabelText('Massive API Key')
    await waitFor(() => expect(input).toHaveValue('my-key'))
  })

  describe('Massive API key', () => {
    it('saves a non-empty key, validates it, and notifies success when tickers are returned', async () => {
      const showSpy = vi.spyOn(notifications, 'show')
      const onPatch = vi.fn()
      const fetchMock = stubFetch({
        prefs: preferences({ massive_api_key: '' }),
        onPatch,
        tickers: [{ ticker: 'C:EURUSD', name: 'EUR/USD', market: 'fx', active: true }],
      })
      renderWithProviders(<ChartsTab />)

      const input = await screen.findByLabelText('Massive API Key')
      fireEvent.change(input, { target: { value: 'abc123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(onPatch).toHaveBeenCalledWith({ massive_api_key: 'abc123' })
      })
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/api/massive/tickers'),
          expect.objectContaining({ method: 'GET' }),
        )
      })
      await waitFor(() => {
        expect(showSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'API key verified — market data is enabled',
          }),
        )
      })
    })

    it('shows a warning when the tickers endpoint returns an empty array', async () => {
      const showSpy = vi.spyOn(notifications, 'show')
      const onPatch = vi.fn()
      stubFetch({
        prefs: preferences({ massive_api_key: '' }),
        onPatch,
        tickers: [],
      })
      renderWithProviders(<ChartsTab />)

      const input = await screen.findByLabelText('Massive API Key')
      fireEvent.change(input, { target: { value: 'bad-key' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(onPatch).toHaveBeenCalledWith({ massive_api_key: 'bad-key' })
      })
      await waitFor(() => {
        expect(showSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Could not verify the API key — check it and try again',
          }),
        )
      })
    })

    it('clears the key, patches with empty string, and skips ticker validation', async () => {
      const onPatch = vi.fn()
      const fetchMock = stubFetch({
        prefs: preferences({ massive_api_key: 'abc123' }),
        onPatch,
      })
      renderWithProviders(<ChartsTab />)

      const input = await screen.findByLabelText('Massive API Key')
      await waitFor(() => expect(input).toHaveValue('abc123'))

      fireEvent.change(input, { target: { value: '' } })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))

      await waitFor(() => {
        expect(onPatch).toHaveBeenCalledWith({ massive_api_key: '' })
      })
      // The tickers validation endpoint must NOT be called when the key is cleared.
      expect(
        fetchMock.mock.calls.every(([url]) => !String(url).startsWith('/api/massive/tickers')),
      ).toBe(true)
    })
  })
})
