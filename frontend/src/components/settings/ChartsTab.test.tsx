import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { ChartsTab } from '@/components/settings/ChartsTab'
import type { Preferences } from '@/types/preferences'
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

function stubFetch(prefs: Preferences = preferences()) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url === '/api/preferences' && method === 'GET') {
      return jsonResponse(prefs)
    }
    if (url === '/api/preferences' && method === 'PATCH') {
      return jsonResponse(prefs)
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
    stubFetch(preferences({ massive_api_key: 'my-key' }))
    renderWithProviders(<ChartsTab />)

    const input = await screen.findByLabelText('Massive API Key')
    await waitFor(() => expect(input).toHaveValue('my-key'))
  })
})
