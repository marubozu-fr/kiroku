import React from 'react'
import { MantineProvider } from '@mantine/core'
import { render, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MonthlyDataPoint, EquityDataPoint } from '@/types/dashboard'
import { renderWithProviders } from '@/test/utils'
import { DashboardCharts } from './DashboardCharts'
import { MonthByMonthChart } from './MonthByMonthChart'
import { EquityCurveChart } from './EquityCurveChart'

/** renderWithProviders variant that returns a rerender function keeping the provider wrapper. */
function renderWithRerender(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MantineProvider>{children}</MantineProvider>
    ),
  })
}

// ---------------------------------------------------------------------------
// Recharts mock — ResponsiveContainer measures parent width which is 0 in
// jsdom. Replace it with a fixed-size wrapper so children actually render.
// ---------------------------------------------------------------------------

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <actual.ResponsiveContainer width={800} height={300}>
        {children}
      </actual.ResponsiveContainer>
    ),
  }
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MONTHLY: MonthlyDataPoint[] = [
  { year: 2026, month: 1, month_label: 'Jan', value_r: 4.2, value_pct: 8.4, trade_count: 5 },
  { year: 2026, month: 2, month_label: 'Feb', value_r: -1.8, value_pct: -3.6, trade_count: 3 },
  { year: 2026, month: 3, month_label: 'Mar', value_r: 6.5, value_pct: 13.0, trade_count: 7 },
]

const EQUITY: EquityDataPoint[] = [
  { date: '2026-01-15', cumulative_r: 2.1, cumulative_pct: 4.2, trade_id: 1 },
  { date: '2026-02-10', cumulative_r: 4.2, cumulative_pct: 8.4, trade_id: 2 },
  { date: '2026-03-20', cumulative_r: 8.5, cumulative_pct: 17.0, trade_id: 3 },
]

// ---------------------------------------------------------------------------
// DashboardCharts container tests
// ---------------------------------------------------------------------------

describe('DashboardCharts', () => {
  it('renders without crashing with valid data and shows the Month tab by default', () => {
    renderWithProviders(
      <DashboardCharts monthly={MONTHLY} equity={EQUITY} displayMode="r" />,
    )

    // Both tab labels are present in the DOM
    expect(screen.getByRole('tab', { name: /month by month/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /equity curve/i })).toBeInTheDocument()

    // Month tab is selected by default
    expect(screen.getByRole('tab', { name: /month by month/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('shows the empty message in the Month panel when monthly data is empty', () => {
    renderWithProviders(
      <DashboardCharts monthly={[]} equity={EQUITY} displayMode="r" />,
    )

    // Month tab is active by default — the empty message should be visible
    expect(screen.getByText('No data for this period')).toBeInTheDocument()
  })

  it('shows empty message in Equity panel after switching to that tab', () => {
    renderWithProviders(
      <DashboardCharts monthly={MONTHLY} equity={[]} displayMode="r" />,
    )

    // Initially on Month tab — no empty message expected yet (monthly has data)
    expect(screen.queryByText('No data for this period')).not.toBeInTheDocument()

    // Click the Equity Curve tab
    fireEvent.click(screen.getByRole('tab', { name: /equity curve/i }))

    // Now the empty message should appear (equity is empty)
    expect(screen.getByText('No data for this period')).toBeInTheDocument()
  })

  it('switches the active tab to Equity Curve on click', () => {
    renderWithProviders(
      <DashboardCharts monthly={MONTHLY} equity={EQUITY} displayMode="r" />,
    )

    const equityTab = screen.getByRole('tab', { name: /equity curve/i })
    fireEvent.click(equityTab)

    expect(equityTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /month by month/i })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('does not crash when displayMode switches from r to pct', () => {
    const { rerender } = renderWithRerender(
      <DashboardCharts monthly={MONTHLY} equity={EQUITY} displayMode="r" />,
    )

    // Re-render with pct mode — should not throw
    rerender(
      <DashboardCharts monthly={MONTHLY} equity={EQUITY} displayMode="pct" />,
    )

    expect(screen.getByRole('tab', { name: /month by month/i })).toBeInTheDocument()
  })

  it('renders the Performance section title', () => {
    renderWithProviders(
      <DashboardCharts monthly={MONTHLY} equity={EQUITY} displayMode="r" />,
    )

    expect(screen.getByText('Performance')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// MonthByMonthChart focused tests
// ---------------------------------------------------------------------------

describe('MonthByMonthChart', () => {
  it('renders the empty message when data is empty', () => {
    renderWithProviders(<MonthByMonthChart data={[]} displayMode="r" />)
    expect(screen.getByText('No data for this period')).toBeInTheDocument()
  })

  it('does not render the empty message when data is provided', () => {
    renderWithProviders(<MonthByMonthChart data={MONTHLY} displayMode="r" />)
    expect(screen.queryByText('No data for this period')).not.toBeInTheDocument()
  })

  it('does not crash when switching displayMode from r to pct', () => {
    const { rerender } = renderWithRerender(
      <MonthByMonthChart data={MONTHLY} displayMode="r" />,
    )
    rerender(<MonthByMonthChart data={MONTHLY} displayMode="pct" />)
    expect(screen.queryByText('No data for this period')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// EquityCurveChart focused tests
// ---------------------------------------------------------------------------

describe('EquityCurveChart', () => {
  it('renders the empty message when data is empty', () => {
    renderWithProviders(<EquityCurveChart data={[]} displayMode="r" />)
    expect(screen.getByText('No data for this period')).toBeInTheDocument()
  })

  it('does not render the empty message when data is provided', () => {
    renderWithProviders(<EquityCurveChart data={EQUITY} displayMode="r" />)
    expect(screen.queryByText('No data for this period')).not.toBeInTheDocument()
  })

  it('does not crash when switching displayMode from r to pct', () => {
    const { rerender } = renderWithRerender(
      <EquityCurveChart data={EQUITY} displayMode="r" />,
    )
    rerender(<EquityCurveChart data={EQUITY} displayMode="pct" />)
    expect(screen.queryByText('No data for this period')).not.toBeInTheDocument()
  })
})
