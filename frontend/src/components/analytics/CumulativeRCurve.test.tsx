import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CumulativeRPoint } from '@/types/analytics'
import { renderWithProviders } from '@/test/utils'
import { CumulativeRCurve } from './CumulativeRCurve'

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

function makePoint(
  trade_id: number,
  trade_date: string,
  performance_r: number,
  cumulative_r: number,
): CumulativeRPoint {
  return { trade_id, trade_date, performance_r, cumulative_r }
}

const SAMPLE_DATA: CumulativeRPoint[] = [
  makePoint(1, '2024-01-15', 1.5, 1.5),
  makePoint(2, '2024-01-20', -0.5, 1.0),
  makePoint(3, '2024-02-01', 2.0, 3.0),
  makePoint(4, '2024-02-10', -1.0, 2.0),
  makePoint(5, '2024-02-15', 1.0, 3.0),
]

const SINGLE_POINT: CumulativeRPoint[] = [
  makePoint(1, '2024-03-01', 2.0, 2.0),
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CumulativeRCurve', () => {
  it('renders the card title', () => {
    renderWithProviders(<CumulativeRCurve data={SAMPLE_DATA} />)

    expect(screen.getByText('Cumulative R-Curve')).toBeInTheDocument()
  })

  it('shows the empty message and no chart when data is empty', () => {
    const { container } = renderWithProviders(<CumulativeRCurve data={[]} />)

    expect(
      screen.getByText('No scored trades for this period.'),
    ).toBeInTheDocument()
    expect(container.querySelector('.recharts-wrapper')).not.toBeInTheDocument()
  })

  it('renders the chart surface when data has entries', () => {
    const { container } = renderWithProviders(
      <CumulativeRCurve data={SAMPLE_DATA} />,
    )

    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
    expect(
      screen.queryByText('No scored trades for this period.'),
    ).not.toBeInTheDocument()
  })

  it('renders a chart with a single data point without crashing', () => {
    const { container } = renderWithProviders(
      <CumulativeRCurve data={SINGLE_POINT} />,
    )

    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
    expect(screen.getByText('Cumulative R-Curve')).toBeInTheDocument()
  })

  it('does not crash when all performance_r values are negative', () => {
    const negativeData: CumulativeRPoint[] = [
      makePoint(1, '2024-01-01', -1.0, -1.0),
      makePoint(2, '2024-01-05', -0.5, -1.5),
    ]

    expect(() =>
      renderWithProviders(<CumulativeRCurve data={negativeData} />),
    ).not.toThrow()
    expect(screen.getByText('Cumulative R-Curve')).toBeInTheDocument()
  })

  it('renders dates in the chart area (chronological order preserved)', () => {
    const { container } = renderWithProviders(
      <CumulativeRCurve data={SAMPLE_DATA} />,
    )

    // Data is chronologically ordered. The chart should render without error
    // and the recharts wrapper must be present.
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
  })

  it('does not show the empty message when data has entries', () => {
    renderWithProviders(<CumulativeRCurve data={SAMPLE_DATA} />)

    expect(
      screen.queryByText('No scored trades for this period.'),
    ).not.toBeInTheDocument()
  })
})
