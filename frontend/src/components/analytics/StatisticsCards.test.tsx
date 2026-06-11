import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/utils'
import type { StatisticsData } from '@/types/analytics'
import { StatisticsCards } from './StatisticsCards'

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

/** Full fixture matching the mockup sample data (84 trades, Jan–Jun 2026). */
const STATS: StatisticsData = {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StatisticsCards', () => {
  it('renders all KPI labels', () => {
    renderWithProviders(<StatisticsCards statistics={STATS} />)

    expect(screen.getByText('Total Trades')).toBeInTheDocument()
    expect(screen.getByText('Total P&L')).toBeInTheDocument()
    expect(screen.getByText('Win Rate')).toBeInTheDocument()
    expect(screen.getByText('Profit Factor')).toBeInTheDocument()
    expect(screen.getByText('Avg P&L')).toBeInTheDocument()
    expect(screen.getByText('Avg Win')).toBeInTheDocument()
    expect(screen.getByText('Avg Loss')).toBeInTheDocument()
    expect(screen.getByText('Expectancy')).toBeInTheDocument()
    expect(screen.getByText('Avg Duration')).toBeInTheDocument()
    expect(screen.getByText('Best / Worst')).toBeInTheDocument()
    expect(screen.getByText('Winning / Losing Streak')).toBeInTheDocument()
  })

  it('formats Total Trades as a plain count (never colored)', () => {
    renderWithProviders(<StatisticsCards statistics={STATS} />)
    expect(screen.getByText('84')).toBeInTheDocument()
  })

  it('formats Total P&L as a signed R value', () => {
    renderWithProviders(<StatisticsCards statistics={STATS} />)
    expect(screen.getByText('+49.00R')).toBeInTheDocument()
  })

  it('formats Win Rate correctly', () => {
    renderWithProviders(<StatisticsCards statistics={STATS} />)
    expect(screen.getByText('59.52%')).toBeInTheDocument()
  })

  it('formats Profit Factor correctly', () => {
    renderWithProviders(<StatisticsCards statistics={STATS} />)
    expect(screen.getByText('2.36')).toBeInTheDocument()
  })

  it('formats Avg Duration as human time', () => {
    renderWithProviders(<StatisticsCards statistics={STATS} />)
    // 4.2h = 4h 12m
    expect(screen.getByText('4h 12m')).toBeInTheDocument()
  })

  it('renders Best / Worst R values', () => {
    renderWithProviders(<StatisticsCards statistics={STATS} />)
    expect(screen.getByText('+8.20R')).toBeInTheDocument()
    expect(screen.getByText('-3.10R')).toBeInTheDocument()
  })

  it('renders Winning / Losing Streak counts', () => {
    renderWithProviders(<StatisticsCards statistics={STATS} />)
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('renders Avg Loss value (negative, semantic)', () => {
    renderWithProviders(<StatisticsCards statistics={STATS} />)
    expect(screen.getByText('-1.20R')).toBeInTheDocument()
  })

  it('renders — when profit_factor is null', () => {
    const nullPf: StatisticsData = { ...STATS, profit_factor: null }
    renderWithProviders(<StatisticsCards statistics={nullPf} />)
    // The em dash rendered for null profit factor
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThan(0)
  })

  it('renders — for null best_trade and worst_trade', () => {
    const nullExtremes: StatisticsData = { ...STATS, best_trade: null, worst_trade: null }
    renderWithProviders(<StatisticsCards statistics={nullExtremes} />)
    const dashes = screen.getAllByText('—')
    // Expect at least two em dashes (best and worst)
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })
})
