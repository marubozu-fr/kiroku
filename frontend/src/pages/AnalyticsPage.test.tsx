import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import type {
  AnalyticsBreakdownsResponse,
  AnalyticsStatisticsResponse,
  AnalyticsTradesResponse,
  StatisticsData,
} from '@/types/analytics'
import { renderWithProviders } from '@/test/utils'

// ---------------------------------------------------------------------------
// Service mock
// ---------------------------------------------------------------------------

vi.mock('@/services/analytics', () => ({
  fetchStatistics: vi.fn(),
  fetchBreakdowns: vi.fn(),
  fetchTrades: vi.fn(),
}))

import { fetchBreakdowns, fetchStatistics, fetchTrades } from '@/services/analytics'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_STATS: StatisticsData = {
  total_trades: 84,
  winning_trades: 50,
  losing_trades: 30,
  breakeven_trades: 4,
  total_pnl: 49.0,
  avg_pnl: 0.58,
  win_rate: 59.52,
  avg_win: 1.7,
  avg_loss: -1.2,
  expectancy: 0.58,
  profit_factor: 2.36,
  avg_duration_hours: 4.2,
  winning_streak: 7,
  losing_streak: 4,
  best_trade: 8.2,
  worst_trade: -3.1,
}

const STATISTICS_RESPONSE: AnalyticsStatisticsResponse = {
  statistics: BASE_STATS,
  available_filters: {
    assets: [],
    directions: [],
    timeframes: [],
    tags: [],
    emotions: [],
    types: [],
    date_range: { min: null, max: null },
  },
}

const BREAKDOWNS_RESPONSE: AnalyticsBreakdownsResponse = {
  by_asset: [],
  by_tag: [],
  by_day_hour: {},
  r_distribution: [],
  cumulative_r: [],
}

const TRADES_RESPONSE: AnalyticsTradesResponse = {
  trades: [],
  pagination: { page: 1, per_page: 20, total: 0, total_pages: 0 },
}

function stubSuccessfulFetch(statsOverride?: Partial<StatisticsData>) {
  const statsResponse: AnalyticsStatisticsResponse = {
    ...STATISTICS_RESPONSE,
    statistics: { ...BASE_STATS, ...statsOverride },
  }
  vi.mocked(fetchStatistics).mockResolvedValue(statsResponse)
  vi.mocked(fetchBreakdowns).mockResolvedValue(BREAKDOWNS_RESPONSE)
  vi.mocked(fetchTrades).mockResolvedValue(TRADES_RESPONSE)
}

function stubFailingFetch() {
  const error = new Error('Network error')
  vi.mocked(fetchStatistics).mockRejectedValue(error)
  vi.mocked(fetchBreakdowns).mockRejectedValue(error)
  vi.mocked(fetchTrades).mockRejectedValue(error)
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderAnalytics() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/analytics']}>
      <Routes>
        <Route path="/analytics" element={<AnalyticsPage />} />
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

describe('AnalyticsPage', () => {
  it('shows loading skeletons while fetching', () => {
    // Arrange: never resolves
    vi.mocked(fetchStatistics).mockReturnValue(new Promise(() => {}))
    vi.mocked(fetchBreakdowns).mockReturnValue(new Promise(() => {}))
    vi.mocked(fetchTrades).mockReturnValue(new Promise(() => {}))

    renderAnalytics()

    const skeletons = document.querySelectorAll('.mantine-Skeleton-root')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders KPI cards after data loads', async () => {
    stubSuccessfulFetch()
    renderAnalytics()

    expect(await screen.findByText('Total Trades')).toBeInTheDocument()
    expect(screen.getByText('84')).toBeInTheDocument()
    expect(screen.getByText('59.52%')).toBeInTheDocument()
    expect(screen.getByText('+49.00R')).toBeInTheDocument()
    expect(screen.getByText('2.36')).toBeInTheDocument()
  })

  it('renders the empty state when total_trades is 0', async () => {
    stubSuccessfulFetch({ total_trades: 0 })
    renderAnalytics()

    expect(await screen.findByText('No trades yet')).toBeInTheDocument()
    expect(screen.queryByText('Total Trades')).not.toBeInTheDocument()
  })

  it('renders the error state when fetch rejects', async () => {
    stubFailingFetch()
    renderAnalytics()

    expect(await screen.findByText('Could not load analytics')).toBeInTheDocument()
  })

  it('renders a retry button in the error state', async () => {
    stubFailingFetch()
    renderAnalytics()

    const retryButton = await screen.findByRole('button', { name: /retry/i })
    expect(retryButton).toBeInTheDocument()
  })

  it('renders placeholder slots when data is populated', async () => {
    stubSuccessfulFetch()
    renderAnalytics()

    await screen.findByText('Total Trades')

    expect(screen.getByText('Filters — coming soon')).toBeInTheDocument()
    expect(screen.getByText('Charts — coming soon')).toBeInTheDocument()
    expect(screen.getByText('Trades table — coming soon')).toBeInTheDocument()
  })

  it('renders the page header with title and subtitle', async () => {
    stubSuccessfulFetch()
    renderAnalytics()

    expect(await screen.findByText('Analytics')).toBeInTheDocument()
    expect(
      screen.getByText('Review your trading performance across all metrics.'),
    ).toBeInTheDocument()
  })

  it('refetches when retry is clicked after an error', async () => {
    stubFailingFetch()
    renderAnalytics()

    const retryButton = await screen.findByRole('button', { name: /retry/i })

    // Now make the next fetch succeed
    stubSuccessfulFetch()

    retryButton.click()

    await waitFor(() => {
      expect(screen.queryByText('Could not load analytics')).not.toBeInTheDocument()
    })
    expect(await screen.findByText('Total Trades')).toBeInTheDocument()
  })
})
