import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from '@/pages/DashboardPage'
import type { DashboardData } from '@/types/dashboard'
import { jsonResponse, renderWithProviders } from '@/test/utils'

// ---------------------------------------------------------------------------
// localStorage mock
//
// Node 25 receives --localstorage-file without a valid path from the vitest
// worker, which installs a non-functional native localStorage stub as the
// global. The component's readStored() helper calls localStorage.getItem at
// useState init time, which would throw. We replace the global with a simple
// in-memory implementation so the component and tests both use the same
// functional storage.
// ---------------------------------------------------------------------------

function makeLocalStorage(): Storage {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]) },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage
}

// Install the mock once at module load so it is in place before any import
// side-effects (like i18next LanguageDetector) read localStorage.
const mockStorage = makeLocalStorage()
vi.stubGlobal('localStorage', mockStorage)

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function dashboardData(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    stats: {
      total_trades: 47,
      win_rate: 63.83,
      avg_r: 0.82,
      profit_factor: 2.14,
      best_r: 6.0,
      worst_r: -2.3,
      total_r: 38.5,
      total_pct: 76.5,
    },
    monthly: [],
    equity: [],
    recent_trades: [],
    ...overrides,
  }
}

function emptyDashboardData(): DashboardData {
  return dashboardData({
    stats: {
      total_trades: 0,
      win_rate: 0,
      avg_r: 0,
      profit_factor: 0,
      best_r: null,
      worst_r: null,
      total_r: 0,
      total_pct: 0,
    },
  })
}

// ---------------------------------------------------------------------------
// Stub helpers
// ---------------------------------------------------------------------------

function stubFetch(response: () => Promise<Response> | Response) {
  const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
    async () => response(),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function stubFetchWithData(data: DashboardData) {
  return stubFetch(() => jsonResponse(data))
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderDashboard() {
  return renderWithProviders(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/journal/new" element={<div>New trade form</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Clear only the two keys the page uses so tests don't leak state.
  localStorage.removeItem('kiroku_dashboard_period')
  localStorage.removeItem('kiroku_dashboard_display_mode')
})

afterEach(() => {
  // Only unstub fetch — keep the localStorage stub installed for the whole file
  // (vi.unstubAllGlobals would remove our localStorage mock too).
  vi.unstubAllGlobals()
  // Re-install localStorage mock after unstubAllGlobals removes it.
  vi.stubGlobal('localStorage', mockStorage)
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardPage', () => {
  it('shows loading skeletons while fetching', () => {
    // Arrange: fetch never resolves
    stubFetch(() => new Promise(() => {}))

    // Act
    renderDashboard()

    // Assert: KPI values are absent, skeletons are present
    expect(screen.queryByText('Total Trades')).not.toBeInTheDocument()
    const skeletons = document.querySelectorAll('.mantine-Skeleton-root')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders KPI cards with correct values from the API', async () => {
    // Arrange
    stubFetchWithData(dashboardData())

    // Act
    renderDashboard()

    // Assert each KPI label + value pair
    expect(await screen.findByText('Total Trades')).toBeInTheDocument()
    expect(screen.getByText('47')).toBeInTheDocument()

    expect(screen.getByText('Win Rate')).toBeInTheDocument()
    expect(screen.getByText('63.83%')).toBeInTheDocument()

    expect(screen.getByText('Avg R')).toBeInTheDocument()
    expect(screen.getByText('+0.82R')).toBeInTheDocument()

    expect(screen.getByText('Profit Factor')).toBeInTheDocument()
    expect(screen.getByText('2.14')).toBeInTheDocument()

    expect(screen.getByText('Best / Worst')).toBeInTheDocument()
    expect(screen.getByText('+6.00R')).toBeInTheDocument()
    expect(screen.getByText('-2.30R')).toBeInTheDocument()
  })

  it('re-fetches with new period when the period selector changes', async () => {
    // Arrange
    const fetchMock = stubFetchWithData(dashboardData())

    renderDashboard()

    // Wait for initial load to complete
    await screen.findByText('Total Trades')

    // Clear call history so we can assert on the next fetch only
    fetchMock.mockClear()

    // Act: click the 5Y radio in the period SegmentedControl
    fireEvent.click(screen.getByRole('radio', { name: '5Y' }))

    // Assert: fetch was called again with period=5y
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
      const calledUrl = fetchMock.mock.calls.at(0)?.[0]
      expect(calledUrl).toContain('period=5y')
    })
  })

  it('switches Avg R to percent display without calling the API again', async () => {
    // Arrange
    const fetchMock = stubFetchWithData(dashboardData())

    renderDashboard()

    // Wait for R mode to appear
    expect(await screen.findByText('+0.82R')).toBeInTheDocument()

    // Clear call history — no more fetches should happen
    fetchMock.mockClear()

    // Act: click the % radio in the display-mode SegmentedControl
    fireEvent.click(screen.getByRole('radio', { name: '%' }))

    // Assert: Avg R shows percent form (76.5 / 47 = 1.6276... → +1.63%)
    expect(await screen.findByText('+1.63%')).toBeInTheDocument()

    // Assert: no additional API call was made
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders the empty state when total_trades is 0', async () => {
    // Arrange
    stubFetchWithData(emptyDashboardData())

    // Act
    renderDashboard()

    // Assert: empty state is shown
    expect(await screen.findByText('Welcome to your dashboard')).toBeInTheDocument()
    expect(screen.getByText('Add my first trade')).toBeInTheDocument()

    // Assert: KPI cards are NOT rendered
    expect(screen.queryByText('Total Trades')).not.toBeInTheDocument()
  })

  describe('localStorage persistence', () => {
    it('persists the selected period to localStorage', async () => {
      // Arrange
      stubFetchWithData(dashboardData())

      renderDashboard()
      await screen.findByText('Total Trades')

      // Act: change period to 5Y
      fireEvent.click(screen.getByRole('radio', { name: '5Y' }))

      // Assert: preference is persisted
      await waitFor(() => {
        expect(localStorage.getItem('kiroku_dashboard_period')).toBe('5y')
      })
    })

    it('uses the seeded display mode from localStorage on first paint', async () => {
      // Arrange: pre-seed percent mode before render
      localStorage.setItem('kiroku_dashboard_display_mode', 'pct')
      stubFetchWithData(dashboardData())

      // Act
      renderDashboard()

      // Assert: first paint uses % mode — Avg R shows percent form
      // 76.5 / 47 = 1.6276... → +1.63%
      expect(await screen.findByText('+1.63%')).toBeInTheDocument()

      // Assert: the % radio is checked
      expect(screen.getByRole('radio', { name: '%' })).toBeChecked()
    })

    it('uses the seeded period from localStorage for the first fetch', async () => {
      // Arrange: pre-seed period before render
      localStorage.setItem('kiroku_dashboard_period', 'all')
      const fetchMock = stubFetchWithData(dashboardData())

      // Act
      renderDashboard()

      // Assert: first fetch URL contains period=all
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled()
        const calledUrl = fetchMock.mock.calls.at(0)?.[0]
        expect(calledUrl).toContain('period=all')
      })
    })
  })
})
