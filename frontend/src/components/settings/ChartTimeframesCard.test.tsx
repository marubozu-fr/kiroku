import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { ChartTimeframesCard } from '@/components/settings/ChartTimeframesCard'
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

function stubFetch(
  handlers: { prefs?: Preferences; onPatch?: (body: unknown) => void } = {},
) {
  const { prefs = preferences(), onPatch } = handlers
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url === '/api/preferences' && method === 'GET') {
      return jsonResponse(prefs)
    }
    if (url === '/api/preferences' && method === 'PATCH') {
      onPatch?.(JSON.parse(init?.body as string))
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

describe('ChartTimeframesCard', () => {
  it('seeds the chip list from preferences, sorted ascending', async () => {
    stubFetch({
      prefs: preferences({
        chart_timeframes_default: [
          { value: 1, unit: 'D' },
          { value: 15, unit: 'm' },
          { value: 4, unit: 'h' },
        ],
      }),
    })
    renderWithProviders(<ChartTimeframesCard />)

    await screen.findByText('15m')
    const chips = screen.getAllByText(/^\d+[mhDW]$/).map((node) => node.textContent)
    expect(chips).toEqual(['15m', '4h', '1D'])
    expect(screen.getByText('3 timeframes')).toBeInTheDocument()
  })

  it('shows the empty state when no timeframes are configured', async () => {
    stubFetch()
    renderWithProviders(<ChartTimeframesCard />)

    expect(
      await screen.findByText(
        'No default timeframes configured. Only the entry timeframe will appear on charts.',
      ),
    ).toBeInTheDocument()
  })

  it('adds a timeframe to the list', async () => {
    stubFetch()
    renderWithProviders(<ChartTimeframesCard />)

    const valueInput = await screen.findByLabelText('Default chart timeframes')
    fireEvent.change(valueInput, { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('5m')).toBeInTheDocument()
    expect(screen.getByText('1 timeframes')).toBeInTheDocument()
  })

  it('rejects a duplicate timeframe with an inline error', async () => {
    stubFetch({
      prefs: preferences({ chart_timeframes_default: [{ value: 15, unit: 'm' }] }),
    })
    renderWithProviders(<ChartTimeframesCard />)

    const valueInput = await screen.findByLabelText('Default chart timeframes')
    fireEvent.change(valueInput, { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(
      await screen.findByText('This timeframe is already in the list'),
    ).toBeInTheDocument()
  })

  it('removes a timeframe from the list', async () => {
    stubFetch({
      prefs: preferences({ chart_timeframes_default: [{ value: 4, unit: 'h' }] }),
    })
    renderWithProviders(<ChartTimeframesCard />)

    fireEvent.click(await screen.findByRole('button', { name: 'Remove 4h' }))

    await waitFor(() => expect(screen.queryByText('4h')).not.toBeInTheDocument())
  })

  it('warns when the count exceeds the configured threshold', async () => {
    stubFetch({
      prefs: preferences({
        chart_timeframes_warning_threshold: 2,
        chart_timeframes_default: [
          { value: 1, unit: 'm' },
          { value: 5, unit: 'm' },
          { value: 15, unit: 'm' },
        ],
      }),
    })
    renderWithProviders(<ChartTimeframesCard />)

    expect(
      await screen.findByText('Chart loading may be slower with more than 2 timeframes'),
    ).toBeInTheDocument()
  })

  it('saves entry timeframe and chart timeframes together via PATCH', async () => {
    const onPatch = vi.fn()
    stubFetch({
      onPatch,
      prefs: preferences({
        entry_timeframe_value_default: 15,
        entry_timeframe_unit_default: 'm',
        chart_timeframes_default: [{ value: 4, unit: 'h' }],
      }),
    })
    renderWithProviders(<ChartTimeframesCard />)

    fireEvent.click(await screen.findByRole('button', { name: 'Save timeframe defaults' }))

    await waitFor(() =>
      expect(onPatch).toHaveBeenCalledWith({
        entry_timeframe_value_default: 15,
        entry_timeframe_unit_default: 'm',
        chart_timeframes_default: [{ value: 4, unit: 'h' }],
      }),
    )
  })

  it('blocks saving a partial entry timeframe', async () => {
    const onPatch = vi.fn()
    stubFetch({ onPatch })
    renderWithProviders(<ChartTimeframesCard />)

    const entryInput = await screen.findByLabelText('Default entry timeframe')
    fireEvent.change(entryInput, { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save timeframe defaults' }))

    expect(
      await screen.findByText('Enter both a value and a unit, or leave both empty.'),
    ).toBeInTheDocument()
    expect(onPatch).not.toHaveBeenCalled()
  })
})
