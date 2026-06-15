import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/utils'
import type { TradeSummary } from '@/types/trade'
import type { NewsEvent } from '@/types/news'
import { TradeCalendar } from './TradeCalendar'

// ---------------------------------------------------------------------------
// Mock @/services/news at the module level so newsApi calls are interceptable.
// ---------------------------------------------------------------------------

vi.mock('@/services/news', () => ({
  newsApi: {
    status: vi.fn(),
    sync: vi.fn(),
    list: vi.fn(),
  },
}))

// Import after vi.mock so we get the mocked module.
import { newsApi } from '@/services/news'
import { assertDefined } from '@/test/helpers'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * All test dates target June 2026.
 * Because selectedYear === currentYear (2026), `defaultDisplayMonth` returns
 * `dayjs().startOf('month')` — June 2026.
 * We pass a live trade in June 2026 to ensure the grid is showing that month.
 * News dates use local-time strings (no trailing Z) so dayjs parses them in
 * local time and the rendered day matches the calendar cell date string.
 */
const YEAR = 2026
const TRADE_DATE = '2026-06-12T09:00:00' // Thursday, in-month cell

function makeTrade(overrides: Partial<TradeSummary> = {}): TradeSummary {
  return {
    id: 1,
    asset_id: 10,
    account_type: 'live',
    status: 'Closed',
    direction: 'Long',
    stop_loss: null,
    notes: null,
    missed_opportunity: false,
    risk_per_trade: null,
    avg_entry_price: null,
    avg_exit_price: null,
    risk: null,
    reward: null,
    performance_r: 2.0,
    timeframe_unit: 'h',
    timeframe_value: 1,
    trade_date: TRADE_DATE,
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

function makeNewsEvent(overrides: Partial<NewsEvent> = {}): NewsEvent {
  return {
    id: 'evt-1',
    date: '2026-06-12T10:00:00', // Same calendar day as TRADE_DATE
    title: 'CPI m/m',
    currency: 'USD',
    impact: 'HIGH',
    forecast: '0.3%',
    previous: '0.2%',
    ...overrides,
  }
}

/** The asset name resolver used in all renders. */
function assetName(id: number | null): string {
  if (id === 10) return 'EURUSD'
  return `Asset#${String(id)}`
}

// ---------------------------------------------------------------------------
// Render helper — wraps in MantineProvider (via renderWithProviders) + Router.
// ---------------------------------------------------------------------------

function renderCalendar(trades: TradeSummary[] = [makeTrade()]) {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/journal']}>
      <Routes>
        <Route
          path="*"
          element={
            <TradeCalendar
              trades={trades}
              assetName={assetName}
              selectedYear={YEAR}
              selectedAccountTypes={new Set(['live'])}
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

/**
 * jsdom renders both the desktop grid (`Box visibleFrom="sm"`, which gets the
 * class `mantine-visible-from-sm`) and the mobile agenda (`Box hiddenFrom="sm"`)
 * — CSS media queries are not applied, so elements appear twice.
 *
 * Scoping queries to the desktop grid avoids duplicate-match errors when the
 * same content is also rendered in the agenda.
 */
function desktopGrid(): HTMLElement {
  return document.querySelector('.mantine-visible-from-sm') as HTMLElement
}

// ---------------------------------------------------------------------------
// Default mock wiring — reset between tests so state does not bleed across.
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.resetAllMocks()
})

function setupNews(events: NewsEvent[] = []) {
  vi.mocked(newsApi.status).mockResolvedValue({ is_stale: false, last_sync: null })
  vi.mocked(newsApi.sync).mockResolvedValue({ synced: 0, week_start: null, week_end: null })
  vi.mocked(newsApi.list).mockResolvedValue(events)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TradeCalendar — news integration', () => {
  it('renders a single news pill (not a link) when a day has exactly 1 news event', async () => {
    const event = makeNewsEvent({ date: '2026-06-12T10:00:00', title: 'CPI m/m' })
    setupNews([event])

    renderCalendar()

    // Scope to the desktop grid so we don't match the duplicate in the agenda.
    const grid = await waitFor(() => {
      const el = desktopGrid()
      expect(el).toBeTruthy()
      return el
    })
    const pill = await within(grid).findByText('CPI m/m')
    expect(pill).toBeInTheDocument()

    // Walk up to the pill container — it must NOT be (or be inside) an anchor.
    const pillContainer = pill.closest('a')
    expect(pillContainer).toBeNull()
  })

  it('renders a single news pill with the correct time', async () => {
    const event = makeNewsEvent({ date: '2026-06-12T10:30:00', title: 'NFP' })
    setupNews([event])

    renderCalendar()

    // Scope to the desktop grid so we don't match the duplicate in the agenda.
    const grid = desktopGrid()
    await within(grid).findByText('NFP')
    // The time span inside the pill is also scoped to the desktop grid.
    expect(within(grid).getByText('10:30')).toBeInTheDocument()
  })

  it('renders a count badge (role=button) instead of 3 separate pills when a day has 3 news events', async () => {
    const events: NewsEvent[] = [
      makeNewsEvent({ id: 'e1', date: '2026-06-12T08:00:00', title: 'Event A', currency: 'USD' }),
      makeNewsEvent({ id: 'e2', date: '2026-06-12T10:00:00', title: 'Event B', currency: 'EUR' }),
      makeNewsEvent({ id: 'e3', date: '2026-06-12T14:00:00', title: 'Event C', currency: 'GBP' }),
    ]
    setupNews(events)

    renderCalendar()

    // The indicator badge only appears in the desktop grid (mobile shows individual pills).
    const grid = desktopGrid()
    const badge = await within(grid).findByRole('button', { name: '3 news events' })
    expect(badge).toBeInTheDocument()
    // The count is visible inside the badge.
    expect(badge).toHaveTextContent('3')

    // No individual pills in the desktop grid — 3 events collapse into the indicator.
    expect(within(grid).queryByText('Event A')).not.toBeInTheDocument()
    expect(within(grid).queryByText('Event B')).not.toBeInTheDocument()
    expect(within(grid).queryByText('Event C')).not.toBeInTheDocument()
  })

  it('renders trade pills unaffected when a day has 0 news events', async () => {
    setupNews([]) // no news

    renderCalendar([makeTrade({ id: 42, asset_id: 10, trade_date: '2026-06-12T09:00:00' })])

    // Scope to the desktop grid to avoid matching the duplicate in the agenda.
    const grid = desktopGrid()
    // Trade pill is rendered as a link in the desktop grid.
    const tradeLink = await within(grid).findByRole('link', { name: /EURUSD/ })
    expect(tradeLink).toBeInTheDocument()

    // No news pill or indicator in the desktop grid.
    expect(within(grid).queryByRole('button', { name: /news events/ })).not.toBeInTheDocument()
  })

  it('calls newsApi.sync before newsApi.list when status reports is_stale: true', async () => {
    vi.mocked(newsApi.status).mockResolvedValue({ is_stale: true, last_sync: null })
    vi.mocked(newsApi.sync).mockResolvedValue({ synced: 5, week_start: null, week_end: null })
    vi.mocked(newsApi.list).mockResolvedValue([])

    renderCalendar()

    await waitFor(() => {
      expect(newsApi.list).toHaveBeenCalledTimes(1)
    })

    expect(newsApi.sync).toHaveBeenCalledTimes(1)

    // Verify ordering: sync must have been called before list.
    const syncOrder = vi.mocked(newsApi.sync).mock.invocationCallOrder[0]
    const listOrder = vi.mocked(newsApi.list).mock.invocationCallOrder[0]
    assertDefined(syncOrder)
    assertDefined(listOrder)
    expect(syncOrder).toBeLessThan(listOrder)
  })

  it('does not call newsApi.sync when status reports is_stale: false', async () => {
    setupNews([]) // is_stale: false

    renderCalendar()

    await waitFor(() => {
      expect(newsApi.list).toHaveBeenCalledTimes(1)
    })

    expect(newsApi.sync).not.toHaveBeenCalled()
  })
})
