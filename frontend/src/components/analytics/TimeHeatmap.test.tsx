import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { DayHourCell } from '@/types/analytics'
import { renderWithProviders } from '@/test/utils'
import { TimeHeatmap } from './TimeHeatmap'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCell(
  total_trades: number,
  winning_trades: number,
  total_pnl: number,
): DayHourCell {
  return {
    total_trades,
    winning_trades,
    total_pnl,
    win_rate: total_trades > 0 ? (winning_trades / total_trades) * 100 : 0,
  }
}

const SAMPLE_DATA: Record<string, Record<string, DayHourCell>> = {
  Monday: {
    '9': makeCell(5, 4, 2.5),
    '10': makeCell(3, 1, -0.8),
  },
  Wednesday: {
    '14': makeCell(2, 2, 1.2),
  },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TimeHeatmap', () => {
  it('renders the card title', () => {
    renderWithProviders(<TimeHeatmap data={SAMPLE_DATA} />)

    expect(screen.getByText('Time Heatmap')).toBeInTheDocument()
  })

  it('shows the empty message and no table when data is empty', () => {
    const { container } = renderWithProviders(<TimeHeatmap data={{}} />)

    expect(
      screen.getByText('No dated trades for this period.'),
    ).toBeInTheDocument()
    expect(container.querySelector('table')).not.toBeInTheDocument()
  })

  it('renders the table when data is present', () => {
    const { container } = renderWithProviders(<TimeHeatmap data={SAMPLE_DATA} />)

    expect(container.querySelector('table')).toBeInTheDocument()
    expect(screen.queryByText('No dated trades for this period.')).not.toBeInTheDocument()
  })

  it('renders exactly 7 data rows (one per weekday)', () => {
    const { container } = renderWithProviders(<TimeHeatmap data={SAMPLE_DATA} />)

    // tbody rows only
    const tbody = container.querySelector('tbody')
    expect(tbody?.querySelectorAll('tr')).toHaveLength(7)
  })

  it('renders Monday as the first row', () => {
    const { container } = renderWithProviders(<TimeHeatmap data={SAMPLE_DATA} />)

    const firstRowLabel = container.querySelector('tbody tr:first-child td')
    expect(firstRowLabel?.textContent).toBe('Mon')
  })

  it('renders 24 hour columns plus the row-label column in the header', () => {
    const { container } = renderWithProviders(<TimeHeatmap data={SAMPLE_DATA} />)

    const headerCells = container.querySelectorAll('thead th')
    // 1 label column + 24 hour columns
    expect(headerCells).toHaveLength(25)
  })

  it('renders 24 data cells per row', () => {
    const { container } = renderWithProviders(<TimeHeatmap data={SAMPLE_DATA} />)

    const rows = container.querySelectorAll('tbody tr')
    rows.forEach((row) => {
      // 1 label td + 24 cell tds
      expect(row.querySelectorAll('td')).toHaveLength(25)
    })
  })

  it('does not show the empty message when data has entries', () => {
    renderWithProviders(<TimeHeatmap data={SAMPLE_DATA} />)

    expect(
      screen.queryByText('No dated trades for this period.'),
    ).not.toBeInTheDocument()
  })
})
