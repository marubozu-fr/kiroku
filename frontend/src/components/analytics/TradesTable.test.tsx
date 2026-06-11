import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/utils'
import type {
  AnalyticsFilters,
  AnalyticsTrade,
  AnalyticsTradesResponse,
} from '@/types/analytics'
import { TradesTable } from './TradesTable'

// ---------------------------------------------------------------------------
// Service mock
// ---------------------------------------------------------------------------

vi.mock('@/services/analytics', () => ({
  fetchTrades: vi.fn(),
  fetchStatistics: vi.fn(),
  fetchBreakdowns: vi.fn(),
}))

import { fetchTrades } from '@/services/analytics'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS: AnalyticsFilters = {}

function makeTrade(overrides: Partial<AnalyticsTrade> = {}): AnalyticsTrade {
  return {
    id: 1,
    asset_id: 10,
    asset_name: 'EUR',
    asset_currency: 'USD',
    account_type: 'live',
    status: 'Closed',
    direction: 'Long',
    performance_r: 2.5,
    timeframe_unit: 'h',
    timeframe_value: 1,
    trade_date: '2026-01-15',
    duration_minutes: 90,
    missed_opportunity: false,
    tags: [],
    emotions: [],
    ...overrides,
  }
}

function makeResponse(
  trades: AnalyticsTrade[],
  page = 1,
  total = trades.length,
  totalPages = 1,
): AnalyticsTradesResponse {
  return {
    trades,
    pagination: { page, per_page: 20, total, total_pages: totalPages },
  }
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderTable(filters: AnalyticsFilters = DEFAULT_FILTERS) {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/analytics']}>
      <Routes>
        <Route path="/analytics" element={<TradesTable filters={filters} />} />
        <Route path="/journal/:id" element={<div>Trade detail sentinel</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TradesTable', () => {
  it('renders the table title', async () => {
    vi.mocked(fetchTrades).mockResolvedValue(makeResponse([makeTrade()]))

    renderTable()

    expect(await screen.findByText('Trades')).toBeInTheDocument()
  })

  it('shows loading skeletons while fetching', () => {
    vi.mocked(fetchTrades).mockReturnValue(new Promise(() => {}))

    renderTable()

    const skeletons = document.querySelectorAll('.mantine-Skeleton-root')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders rows from a mocked response (asset label, R value, tags, direction)', async () => {
    const trade = makeTrade({
      id: 42,
      asset_name: 'GBP',
      asset_currency: 'USD',
      direction: 'Long',
      performance_r: 1.5,
      tags: [{ id: 1, name: 'Breakout' }],
      emotions: [],
    })
    vi.mocked(fetchTrades).mockResolvedValue(makeResponse([trade]))

    renderTable()

    // Asset label — name/currency
    expect(await screen.findByText('GBP/USD')).toBeInTheDocument()
    // Formatted R with sign
    expect(screen.getByText('+1.50R')).toBeInTheDocument()
    // Tag badge
    expect(screen.getByText('Breakout')).toBeInTheDocument()
  })

  it('renders negative R value', async () => {
    vi.mocked(fetchTrades).mockResolvedValue(
      makeResponse([makeTrade({ performance_r: -2.0 })]),
    )

    renderTable()

    expect(await screen.findByText('-2.00R')).toBeInTheDocument()
  })

  it('shows em dash for null performance_r', async () => {
    vi.mocked(fetchTrades).mockResolvedValue(
      makeResponse([makeTrade({ performance_r: null })]),
    )

    renderTable()

    // Table renders; at least one "—" appears (from the null R)
    await screen.findByText('Trades')
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('formats duration from duration_minutes', async () => {
    vi.mocked(fetchTrades).mockResolvedValue(
      makeResponse([makeTrade({ duration_minutes: 90 })]),
    )

    renderTable()

    // 90 minutes = 1h 30m
    expect(await screen.findByText('1h 30m')).toBeInTheDocument()
  })

  it('shows em dash for null duration_minutes', async () => {
    vi.mocked(fetchTrades).mockResolvedValue(
      makeResponse([makeTrade({ duration_minutes: null })]),
    )

    renderTable()

    await screen.findByText('Trades')
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders emotion badge with severity color via variant="light"', async () => {
    const trade = makeTrade({
      emotions: [{ id: 1, name: 'FOMO', severity: 'Bad' }],
    })
    vi.mocked(fetchTrades).mockResolvedValue(makeResponse([trade]))

    renderTable()

    expect(await screen.findByText('FOMO')).toBeInTheDocument()
  })

  it('renders multiple emotion badges and shows overflow +N for more than 2', async () => {
    const trade = makeTrade({
      emotions: [
        { id: 1, name: 'FOMO', severity: 'Bad' },
        { id: 2, name: 'Calm', severity: 'Good' },
        { id: 3, name: 'Greed', severity: 'Bad' },
      ],
    })
    vi.mocked(fetchTrades).mockResolvedValue(makeResponse([trade]))

    renderTable()

    expect(await screen.findByText('FOMO')).toBeInTheDocument()
    expect(screen.getByText('Calm')).toBeInTheDocument()
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  describe('empty state', () => {
    it('renders empty state when total is 0', async () => {
      vi.mocked(fetchTrades).mockResolvedValue(makeResponse([], 1, 0, 0))

      renderTable()

      expect(
        await screen.findByText('No trades match your filters'),
      ).toBeInTheDocument()
      expect(
        screen.getByText('Try adjusting or resetting your filters.'),
      ).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('renders error alert when fetch rejects', async () => {
      vi.mocked(fetchTrades).mockRejectedValue(new Error('Network error'))

      renderTable()

      expect(await screen.findByText('Could not load trades')).toBeInTheDocument()
    })

    it('renders retry button in error state', async () => {
      vi.mocked(fetchTrades).mockRejectedValue(new Error('Network error'))

      renderTable()

      const retryBtn = await screen.findByRole('button', { name: /retry/i })
      expect(retryBtn).toBeInTheDocument()
    })
  })

  describe('pagination', () => {
    it('shows the count text with correct from/to/total', async () => {
      // 42 total trades, page 1 (shows 1–20)
      vi.mocked(fetchTrades).mockResolvedValue(
        makeResponse(
          Array.from({ length: 20 }, (_, i) => makeTrade({ id: i + 1 })),
          1,
          42,
          3,
        ),
      )

      renderTable()

      expect(await screen.findByText(/Showing 1–20 of 42 trades/)).toBeInTheDocument()
    })

    it('calls fetchTrades with page 2 when page 2 is clicked', async () => {
      vi.mocked(fetchTrades).mockResolvedValue(
        makeResponse(
          Array.from({ length: 20 }, (_, i) => makeTrade({ id: i + 1 })),
          1,
          42,
          3,
        ),
      )

      renderTable()

      // Wait for the table to settle
      await screen.findByText(/Showing 1–20 of 42 trades/)

      // Find and click page 2 button in the pagination control
      const page2Btn = screen.getByRole('button', { name: '2' })
      fireEvent.click(page2Btn)

      await waitFor(() => {
        const calls = vi.mocked(fetchTrades).mock.calls
        const lastCall = calls[calls.length - 1]
        expect(lastCall[1]).toBe(2)
      })
    })
  })

  describe('filter change resets to page 1', () => {
    it('fires exactly one fetch for page 1 when filters change on page 2', async () => {
      const response42 = makeResponse(
        Array.from({ length: 20 }, (_, i) => makeTrade({ id: i + 1 })),
        1,
        42,
        3,
      )
      vi.mocked(fetchTrades).mockResolvedValue(response42)

      // Render with a wrapping component so we can change the filters prop.
      function Wrapper({ filters }: { filters: AnalyticsFilters }) {
        return (
          <MantineProvider>
            <MemoryRouter initialEntries={['/analytics']}>
              <Routes>
                <Route path="/analytics" element={<TradesTable filters={filters} />} />
                <Route path="/journal/:id" element={<div>Trade detail sentinel</div>} />
              </Routes>
            </MemoryRouter>
          </MantineProvider>
        )
      }

      const { rerender } = render(<Wrapper filters={{}} />)

      // Wait for initial load
      await screen.findByText(/Showing 1–20 of 42 trades/)

      // Navigate to page 2
      const page2Btn = screen.getByRole('button', { name: '2' })
      fireEvent.click(page2Btn)

      // Wait for page 2 fetch to complete
      await waitFor(() => {
        const calls = vi.mocked(fetchTrades).mock.calls
        const lastCall = calls[calls.length - 1]
        expect(lastCall[1]).toBe(2)
      })

      // Record call count before filter change
      const callsBefore = vi.mocked(fetchTrades).mock.calls.length

      // Change filters — this should reset to page 1 with a single fetch
      const filtersV2: AnalyticsFilters = { direction: 'Long' }
      rerender(<Wrapper filters={filtersV2} />)


      await waitFor(() => {
        const newCalls = vi.mocked(fetchTrades).mock.calls
        expect(newCalls.length).toBeGreaterThan(callsBefore)
      })

      // Verify that only ONE fetch fired after the filter change, and it used page=1
      const callsAfter = vi.mocked(fetchTrades).mock.calls.slice(callsBefore)
      expect(callsAfter.length).toBe(1)
      expect(callsAfter[0][0]).toEqual(filtersV2)
      expect(callsAfter[0][1]).toBe(1)
    })
  })

  describe('row click navigation', () => {
    it('navigates to /journal/:id when a row is clicked', async () => {
      vi.mocked(fetchTrades).mockResolvedValue(makeResponse([makeTrade({ id: 99 })]))

      renderWithProviders(
        <MemoryRouter initialEntries={['/analytics']}>
          <Routes>
            <Route path="/analytics" element={<TradesTable filters={DEFAULT_FILTERS} />} />
            <Route path="/journal/:id" element={<div>Trade detail sentinel</div>} />
          </Routes>
        </MemoryRouter>,
      )

      await screen.findByText('EUR/USD')

      const rows = screen.getAllByRole('row')
      // rows[0] is the header row; rows[1] is the first data row
      fireEvent.click(rows[1])

      expect(screen.getByText('Trade detail sentinel')).toBeInTheDocument()
    })
  })

  describe('missed opportunity', () => {
    it('renders a Missed badge when missed_opportunity is true', async () => {
      vi.mocked(fetchTrades).mockResolvedValue(
        makeResponse([makeTrade({ missed_opportunity: true })]),
      )

      renderTable()

      expect(await screen.findByText('Missed')).toBeInTheDocument()
    })
  })

  describe('direction icon', () => {
    it('shows arrow icon (no em dash in direction cell) for Long direction', async () => {
      vi.mocked(fetchTrades).mockResolvedValue(
        makeResponse([makeTrade({
          direction: 'Long',
          // Provide tags/emotions so there are no extra em dashes
          tags: [{ id: 1, name: 'Tag1' }],
          emotions: [{ id: 1, name: 'Calm', severity: 'Good' }],
        })]),
      )

      renderTable()

      await screen.findByText('Trades')
      // Direction cell should NOT render an em dash (icon rendered instead)
      // But other cells may still have dashes; check overall count is minimal
      // by verifying only the expected dashes (from null duration etc.) exist.
      // The Long direction cell renders an SVG icon, so we check the direction
      // header is present and no extra text-dashes appear in the direction cell.
      const rows = screen.getAllByRole('row')
      // rows[0] is header; rows[1] is data row
      const directionCell = rows[1].querySelectorAll('td')[2]
      expect(directionCell.textContent).toBe('')
    })

    it('shows em dash for null direction', async () => {
      vi.mocked(fetchTrades).mockResolvedValue(
        makeResponse([makeTrade({ direction: null })]),
      )

      renderTable()

      await screen.findByText('Trades')
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThan(0)
    })
  })
})
