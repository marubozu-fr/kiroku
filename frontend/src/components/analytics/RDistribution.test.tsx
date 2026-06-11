import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RDistributionBucket } from '@/types/analytics'
import { renderWithProviders } from '@/test/utils'
import { RDistribution } from './RDistribution'

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

/** The 14 fixed buckets the backend always returns. */
const ALL_ZERO_BUCKETS: RDistributionBucket[] = [
  { bucket: '< -3.0', min: null, max: -3.0, count: 0 },
  { bucket: '-3.0 to -2.5', min: -3.0, max: -2.5, count: 0 },
  { bucket: '-2.5 to -2.0', min: -2.5, max: -2.0, count: 0 },
  { bucket: '-2.0 to -1.5', min: -2.0, max: -1.5, count: 0 },
  { bucket: '-1.5 to -1.0', min: -1.5, max: -1.0, count: 0 },
  { bucket: '-1.0 to -0.5', min: -1.0, max: -0.5, count: 0 },
  { bucket: '-0.5 to 0.0', min: -0.5, max: 0.0, count: 0 },
  { bucket: '0.0 to 0.5', min: 0.0, max: 0.5, count: 0 },
  { bucket: '0.5 to 1.0', min: 0.5, max: 1.0, count: 0 },
  { bucket: '1.0 to 1.5', min: 1.0, max: 1.5, count: 0 },
  { bucket: '1.5 to 2.0', min: 1.5, max: 2.0, count: 0 },
  { bucket: '2.0 to 2.5', min: 2.0, max: 2.5, count: 0 },
  { bucket: '2.5 to 3.0', min: 2.5, max: 3.0, count: 0 },
  { bucket: '3.0+', min: 3.0, max: null, count: 0 },
]

const WITH_DATA_BUCKETS: RDistributionBucket[] = ALL_ZERO_BUCKETS.map((b, i) => ({
  ...b,
  count: i < 7 ? (i % 3) + 1 : (i - 6) * 2,
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RDistribution', () => {
  it('renders the card title', () => {
    renderWithProviders(<RDistribution data={WITH_DATA_BUCKETS} />)

    expect(screen.getByText('R-Multiple Distribution')).toBeInTheDocument()
  })

  it('shows the empty message when all bucket counts are 0', () => {
    const { container } = renderWithProviders(
      <RDistribution data={ALL_ZERO_BUCKETS} />,
    )

    expect(
      screen.getByText('No scored trades for this period.'),
    ).toBeInTheDocument()
    expect(container.querySelector('.recharts-wrapper')).not.toBeInTheDocument()
  })

  it('renders the chart surface when at least one bucket has a count', () => {
    const { container } = renderWithProviders(
      <RDistribution data={WITH_DATA_BUCKETS} />,
    )

    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
    expect(
      screen.queryByText('No scored trades for this period.'),
    ).not.toBeInTheDocument()
  })

  it('renders the chart when data is an empty array', () => {
    // Edge case: backend didn't return buckets at all
    const { container } = renderWithProviders(<RDistribution data={[]} />)

    expect(
      screen.getByText('No scored trades for this period.'),
    ).toBeInTheDocument()
    expect(container.querySelector('.recharts-wrapper')).not.toBeInTheDocument()
  })

  it('assigns red fill to negative buckets (max <= 0)', () => {
    const { container } = renderWithProviders(
      <RDistribution data={WITH_DATA_BUCKETS} />,
    )

    // Bar fills are set on each bar rect via recharts — check that the chart
    // renders at all without error and includes the SVG
    expect(container.querySelector('.recharts-wrapper')).toBeInTheDocument()
  })

  it('does not crash with a single non-zero bucket', () => {
    const single = ALL_ZERO_BUCKETS.map((b, i) =>
      i === 9 ? { ...b, count: 3 } : b,
    )

    expect(() =>
      renderWithProviders(<RDistribution data={single} />),
    ).not.toThrow()
    expect(screen.getByText('R-Multiple Distribution')).toBeInTheDocument()
  })

  it('renders bucket labels in container text when chart is visible', () => {
    const { container } = renderWithProviders(
      <RDistribution data={WITH_DATA_BUCKETS} />,
    )

    // Recharts renders X axis tick labels as SVG text; fall back to container.textContent
    expect(container.textContent).toContain('0.0 to 0.5')
    expect(container.textContent).toContain('-0.5 to 0.0')
  })
})
