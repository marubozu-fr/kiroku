import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AssetBreakdown as AssetBreakdownType } from '@/types/analytics'
import { renderWithProviders } from '@/test/utils'
import { AssetBreakdown } from './AssetBreakdown'

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

function makeAsset(
  id: number,
  name: string,
  total_pnl: number,
  total_trades = 10,
  winning_trades = 6,
): AssetBreakdownType {
  return {
    asset_id: id,
    asset_name: name,
    asset_currency: 'USD',
    total_trades,
    winning_trades,
    losing_trades: total_trades - winning_trades,
    breakeven_trades: 0,
    total_pnl,
    win_rate: (winning_trades / total_trades) * 100,
    avg_pnl: total_pnl / total_trades,
    profit_factor: winning_trades > 0 ? 1.5 : null,
  }
}

const TWO_ITEMS: AssetBreakdownType[] = [
  makeAsset(1, 'EURUSD', 4.2, 12, 8),
  makeAsset(2, 'GBPUSD', -1.8, 8, 3),
]

const MANY_ITEMS: AssetBreakdownType[] = Array.from({ length: 12 }, (_, i) =>
  makeAsset(
    i + 1,
    `ASSET${String(i + 1).padStart(2, '0')}`,
    i % 3 === 0 ? -(i + 1) * 0.5 : (i + 1) * 0.8,
    10 - (i % 5),
    6 - (i % 3),
  ),
)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AssetBreakdown', () => {
  it('renders the card title with two data items', () => {
    renderWithProviders(<AssetBreakdown data={TWO_ITEMS} />)

    expect(screen.getByText('Asset Breakdown')).toBeInTheDocument()
  })

  it('renders category labels for each asset when data has two or more items', () => {
    const { container } = renderWithProviders(<AssetBreakdown data={TWO_ITEMS} />)

    // Recharts also creates a hidden measurement span with the same text, so
    // multiple elements with the label text exist — use container.textContent.
    expect(container.textContent).toContain('EURUSD')
    expect(container.textContent).toContain('GBPUSD')
  })

  it('does not show empty or need-more messages when data has two or more items', () => {
    renderWithProviders(<AssetBreakdown data={TWO_ITEMS} />)

    expect(
      screen.queryByText('No asset data for this period.'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('At least two items are needed to chart a breakdown.'),
    ).not.toBeInTheDocument()
  })

  it('shows the empty message and no chart when data is empty', () => {
    const { container } = renderWithProviders(<AssetBreakdown data={[]} />)

    expect(screen.getByText('No asset data for this period.')).toBeInTheDocument()
    expect(container.querySelector('.recharts-wrapper')).not.toBeInTheDocument()
  })

  it('shows the need-more message and no chart when data has exactly one item', () => {
    const { container } = renderWithProviders(
      <AssetBreakdown data={[makeAsset(1, 'EURUSD', 2.5)]} />,
    )

    expect(
      screen.getByText('At least two items are needed to chart a breakdown.'),
    ).toBeInTheDocument()
    expect(container.querySelector('.recharts-wrapper')).not.toBeInTheDocument()
  })

  it('renders an "Others" label when more than 10 items are provided', () => {
    const { container } = renderWithProviders(<AssetBreakdown data={MANY_ITEMS} />)

    // The YAxis category tick for the aggregated remainder renders as SVG text.
    // Fall back to container.textContent in case the text node is split.
    const hasOthers =
      screen.queryByText('Others') !== null ||
      (container.textContent?.includes('Others') ?? false)

    expect(hasOthers).toBe(true)
  })

  it('renders the chart surface when data has two or more items', () => {
    const { container } = renderWithProviders(<AssetBreakdown data={TWO_ITEMS} />)

    // The recharts SVG wrapper is always present when the chart renders.
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
  })

  it('does not crash when all total_pnl values are negative', () => {
    const negativeData: AssetBreakdownType[] = [
      makeAsset(1, 'EURUSD', -3.0, 10, 2),
      makeAsset(2, 'GBPUSD', -1.5, 8, 3),
    ]

    expect(() => renderWithProviders(<AssetBreakdown data={negativeData} />)).not.toThrow()
    expect(screen.getByText('Asset Breakdown')).toBeInTheDocument()
  })

  it('does not crash when profit_factor is null', () => {
    const nullPfData: AssetBreakdownType[] = [
      { ...makeAsset(1, 'EURUSD', 2.0), profit_factor: null },
      { ...makeAsset(2, 'GBPUSD', 1.0), profit_factor: null },
    ]

    expect(() => renderWithProviders(<AssetBreakdown data={nullPfData} />)).not.toThrow()
    expect(screen.getByText('Asset Breakdown')).toBeInTheDocument()
  })
})
