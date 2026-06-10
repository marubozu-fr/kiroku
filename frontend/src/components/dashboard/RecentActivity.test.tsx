import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { RecentTradeItem } from '@/types/dashboard'
import { renderWithProviders } from '@/test/utils'
import { RecentActivity } from './RecentActivity'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTradeItem(overrides: Partial<RecentTradeItem> = {}): RecentTradeItem {
  return {
    id: 1,
    asset_name: 'EUR',
    asset_currency: 'USD',
    direction: 'Long',
    status: 'Closed',
    performance_r: 2.5,
    performance_pct: 5.0,
    trade_date: '2026-01-15',
    ...overrides,
  }
}

function makeTrades(count: number): RecentTradeItem[] {
  return Array.from({ length: count }, (_, i) =>
    makeTradeItem({
      id: i + 1,
      asset_name: `ASSET${i + 1}`,
      performance_r: i % 2 === 0 ? 2.5 : -1.5,
      performance_pct: i % 2 === 0 ? 5.0 : -3.0,
    }),
  )
}

// ---------------------------------------------------------------------------
// Render helper — wraps in MemoryRouter so navigation and Link work.
// ---------------------------------------------------------------------------

function renderActivity(
  trades: RecentTradeItem[],
  displayMode: 'r' | 'pct' = 'r',
  initialPath = '/',
) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={<RecentActivity trades={trades} displayMode={displayMode} />}
        />
        <Route path="/journal/:id" element={<div>Trade detail sentinel</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecentActivity', () => {
  it('renders the correct number of rows', () => {
    renderActivity(makeTrades(10))

    // 10 data rows — verify by counting cells in the asset column
    const rows = screen.getAllByRole('row')
    // rows includes the header row, so expect 10 data rows + 1 header = 11
    expect(rows).toHaveLength(11)
  })

  it('renders the section title', () => {
    renderActivity(makeTrades(1))
    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
  })

  it('shows the empty state when trades is empty', () => {
    renderActivity([])
    expect(screen.getByText('No recent trades')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows the view all link even when empty', () => {
    renderActivity([])
    expect(screen.getByRole('link', { name: /view all trades/i })).toBeInTheDocument()
  })

  describe('P&L display mode', () => {
    it('shows R format when displayMode is r', () => {
      renderActivity([makeTradeItem({ performance_r: 2.5 })], 'r')
      expect(screen.getByText('+2.50R')).toBeInTheDocument()
    })

    it('shows percent format when displayMode is pct', () => {
      renderActivity([makeTradeItem({ performance_pct: 5.0 })], 'pct')
      expect(screen.getByText('+5.00%')).toBeInTheDocument()
    })

    it('shows em dash for null performance_r in r mode', () => {
      renderActivity([makeTradeItem({ performance_r: null })], 'r')
      // formatR(null) returns '—'
      const cells = screen.getAllByRole('cell')
      const pnlCell = cells[cells.length - 1]
      expect(pnlCell.textContent).toBe('—')
    })

    it('shows em dash for null performance_pct in pct mode', () => {
      renderActivity([makeTradeItem({ performance_pct: null })], 'pct')
      const cells = screen.getAllByRole('cell')
      const pnlCell = cells[cells.length - 1]
      expect(pnlCell.textContent).toBe('—')
    })

    it('shows negative R value with red color indicator', () => {
      renderActivity([makeTradeItem({ performance_r: -1.5 })], 'r')
      expect(screen.getByText('-1.50R')).toBeInTheDocument()
    })

    it('shows positive value in r mode', () => {
      renderActivity([makeTradeItem({ performance_r: 2.5 })], 'r')
      expect(screen.getByText('+2.50R')).toBeInTheDocument()
    })

    it('shows negative percent value', () => {
      renderActivity([makeTradeItem({ performance_pct: -3.0 })], 'pct')
      expect(screen.getByText('-3.00%')).toBeInTheDocument()
    })
  })

  describe('direction badge', () => {
    it('renders a Long badge for Long direction', () => {
      renderActivity([makeTradeItem({ direction: 'Long' })])
      expect(screen.getByText('Long')).toBeInTheDocument()
    })

    it('renders a Short badge for Short direction', () => {
      renderActivity([makeTradeItem({ direction: 'Short' })])
      expect(screen.getByText('Short')).toBeInTheDocument()
    })

    it('shows em dash for null direction', () => {
      renderActivity([makeTradeItem({ direction: null })])
      // The dash for direction; find it in the direction cell
      // With null direction the Text component with — is rendered
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThan(0)
    })
  })

  describe('asset formatting', () => {
    it('formats asset as name/currency when both present', () => {
      renderActivity([makeTradeItem({ asset_name: 'EUR', asset_currency: 'USD' })])
      expect(screen.getByText('EUR/USD')).toBeInTheDocument()
    })

    it('shows only name when currency is null', () => {
      renderActivity([makeTradeItem({ asset_name: 'AAPL', asset_currency: null })])
      expect(screen.getByText('AAPL')).toBeInTheDocument()
    })

    it('shows em dash when both asset fields are null', () => {
      renderActivity([makeTradeItem({ asset_name: null, asset_currency: null })])
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThan(0)
    })
  })

  describe('row click navigation', () => {
    it('navigates to /journal/:id when a row is clicked', () => {
      renderWithProviders(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route
              path="/"
              element={<RecentActivity trades={[makeTradeItem({ id: 42 })]} displayMode="r" />}
            />
            <Route path="/journal/:id" element={<div>Trade detail sentinel</div>} />
          </Routes>
        </MemoryRouter>,
      )

      // Click the first data row
      const rows = screen.getAllByRole('row')
      // rows[0] is the header, rows[1] is the first data row
      fireEvent.click(rows[1])

      expect(screen.getByText('Trade detail sentinel')).toBeInTheDocument()
    })
  })

  describe('view all link', () => {
    it('renders a link to /journal', () => {
      renderActivity(makeTrades(3))
      const link = screen.getByRole('link', { name: /view all trades/i })
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', '/journal')
    })
  })
})
