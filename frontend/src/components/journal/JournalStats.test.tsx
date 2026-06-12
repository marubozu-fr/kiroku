import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/utils'
import type { TradeSummary } from '@/types/trade'
import { JournalStats } from './JournalStats'

function makeTrade(overrides: Partial<TradeSummary> = {}): TradeSummary {
  return {
    id: 1,
    asset_id: 10,
    account_type: 'live',
    status: 'Closed',
    direction: 'Long',
    stop_loss: null,
    notes: null,
    missed_opportunity: false,
    risk_per_trade: null,
    avg_entry_price: null,
    avg_exit_price: null,
    risk: null,
    reward: null,
    performance_r: 2.0,
    timeframe_unit: 'h',
    timeframe_value: 1,
    trade_date: '2026-01-15',
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

/** Reads the value rendered inside the card carrying the given label. */
function cardValue(label: string): string {
  const labelNode = screen.getByText(label)
  const card = labelNode.parentElement as HTMLElement
  const value = card.querySelector('.mantine-Text-root:not(:first-child)')
  return value?.textContent ?? ''
}

describe('JournalStats', () => {
  it('excludes missed_opportunity trades from every metric', () => {
    const trades: TradeSummary[] = [
      makeTrade({ id: 1, performance_r: 2.0 }),
      makeTrade({ id: 2, performance_r: -1.0 }),
      // A missed opportunity with a large positive R that must NOT count.
      makeTrade({ id: 3, performance_r: 5.0, missed_opportunity: true }),
    ]

    renderWithProviders(<JournalStats trades={trades} />)

    // Only the two taken trades are counted: total +1.00R, 50% win rate,
    // +0.50R average. The +5.00R missed trade is ignored entirely.
    expect(cardValue('Total Trades')).toBe('2')
    expect(cardValue('Total P&L')).toBe('+1.00R')
    expect(cardValue('Win Rate')).toBe('50%')
    expect(cardValue('Avg P&L')).toBe('+0.50R')
  })

  it('counts ordinary trades normally when none are missed', () => {
    const trades: TradeSummary[] = [
      makeTrade({ id: 1, performance_r: 3.0 }),
      makeTrade({ id: 2, performance_r: 1.0 }),
    ]

    renderWithProviders(<JournalStats trades={trades} />)

    expect(cardValue('Total Trades')).toBe('2')
    expect(cardValue('Total P&L')).toBe('+4.00R')
    expect(cardValue('Win Rate')).toBe('100%')
    expect(cardValue('Avg P&L')).toBe('+2.00R')
  })
})
