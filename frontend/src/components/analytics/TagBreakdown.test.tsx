import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TagBreakdown as TagBreakdownType } from '@/types/analytics'
import { renderWithProviders } from '@/test/utils'
import { TagBreakdown } from './TagBreakdown'

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

function makeTag(
  id: number,
  name: string,
  total_pnl: number,
  total_trades = 10,
  winning_trades = 6,
): TagBreakdownType {
  return {
    tag_id: id,
    tag_name: name,
    total_trades,
    winning_trades,
    losing_trades: total_trades - winning_trades,
    breakeven_trades: 0,
    total_pnl,
    win_rate: (winning_trades / total_trades) * 100,
    avg_pnl: total_pnl / total_trades,
    profit_factor: winning_trades > 0 ? 1.4 : null,
  }
}

const TWO_ITEMS: TagBreakdownType[] = [
  makeTag(1, 'breakout', 3.6, 10, 7),
  makeTag(2, 'reversal', -1.2, 6, 2),
]

const MANY_ITEMS: TagBreakdownType[] = Array.from({ length: 12 }, (_, i) =>
  makeTag(
    i + 1,
    `tag-${String(i + 1).padStart(2, '0')}`,
    i % 3 === 0 ? -(i + 1) * 0.4 : (i + 1) * 0.7,
    9 - (i % 4),
    5 - (i % 3),
  ),
)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TagBreakdown', () => {
  it('renders the card title with two data items', () => {
    renderWithProviders(<TagBreakdown data={TWO_ITEMS} />)

    expect(screen.getByText('Tag Breakdown')).toBeInTheDocument()
  })

  it('renders category labels for each tag when data has two or more items', () => {
    const { container } = renderWithProviders(<TagBreakdown data={TWO_ITEMS} />)

    // Recharts also creates a hidden measurement span with the same text, so
    // multiple elements with the label text exist — use container.textContent.
    expect(container.textContent).toContain('breakout')
    expect(container.textContent).toContain('reversal')
  })

  it('does not show empty or need-more messages when data has two or more items', () => {
    renderWithProviders(<TagBreakdown data={TWO_ITEMS} />)

    expect(
      screen.queryByText('No tags used in any trade for this period.'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText('At least two items are needed to chart a breakdown.'),
    ).not.toBeInTheDocument()
  })

  it('shows the empty message and no chart when data is empty', () => {
    const { container } = renderWithProviders(<TagBreakdown data={[]} />)

    expect(
      screen.getByText('No tags used in any trade for this period.'),
    ).toBeInTheDocument()
    expect(container.querySelector('.recharts-wrapper')).not.toBeInTheDocument()
  })

  it('shows the need-more message and no chart when data has exactly one item', () => {
    const { container } = renderWithProviders(
      <TagBreakdown data={[makeTag(1, 'breakout', 2.0)]} />,
    )

    expect(
      screen.getByText('At least two items are needed to chart a breakdown.'),
    ).toBeInTheDocument()
    expect(container.querySelector('.recharts-wrapper')).not.toBeInTheDocument()
  })

  it('renders an "Others" label when more than 10 items are provided', () => {
    const { container } = renderWithProviders(<TagBreakdown data={MANY_ITEMS} />)

    // The YAxis category tick for the aggregated remainder renders as SVG text.
    // Fall back to container.textContent in case the text node is split.
    const hasOthers =
      screen.queryByText('Others') !== null ||
      (container.textContent?.includes('Others') ?? false)

    expect(hasOthers).toBe(true)
  })

  it('renders the chart surface when data has two or more items', () => {
    const { container } = renderWithProviders(<TagBreakdown data={TWO_ITEMS} />)

    // The recharts SVG wrapper is always present when the chart renders.
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
  })

  it('does not crash when all total_pnl values are negative', () => {
    const negativeData: TagBreakdownType[] = [
      makeTag(1, 'fomo', -2.5, 8, 2),
      makeTag(2, 'revenge', -1.8, 6, 1),
    ]

    expect(() => renderWithProviders(<TagBreakdown data={negativeData} />)).not.toThrow()
    expect(screen.getByText('Tag Breakdown')).toBeInTheDocument()
  })

  it('does not crash when profit_factor is null', () => {
    const nullPfData: TagBreakdownType[] = [
      { ...makeTag(1, 'breakout', 1.5), profit_factor: null },
      { ...makeTag(2, 'trend-follow', 0.8), profit_factor: null },
    ]

    expect(() => renderWithProviders(<TagBreakdown data={nullPfData} />)).not.toThrow()
    expect(screen.getByText('Tag Breakdown')).toBeInTheDocument()
  })
})
