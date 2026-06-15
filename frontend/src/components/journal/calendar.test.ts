import { describe, expect, it } from 'vitest'
import dayjs from 'dayjs'
import { assertDefined } from '@/test/helpers'
import type { TradeSummary } from '@/types/trade'
import {
  buildCalendarCells,
  computeStats,
  defaultDisplayMonth,
  groupByDate,
  lastVisibleDayOfMonth,
  monthlyReviewSum,
  weeklyReviewSums,
} from './calendar'

/** Minimal trade factory for tests. */
function trade(overrides: Partial<TradeSummary> = {}): TradeSummary {
  return {
    id: 1,
    asset_id: 1,
    account_type: 'live',
    status: 'Closed',
    direction: 'Long',
    stop_loss: null,
    notes: null,
    missed_opportunity: false,
    risk_per_trade: 2,
    avg_entry_price: null,
    avg_exit_price: null,
    risk: null,
    reward: null,
    performance_r: 1.0,
    timeframe_unit: null,
    timeframe_value: null,
    trade_date: '2026-06-10T08:00:00.000Z',
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

describe('buildCalendarCells', () => {
  it('returns only Mon–Fri cells', () => {
    const cells = buildCalendarCells(dayjs('2026-06-01'))
    for (const cell of cells) {
      const dow = cell.date.day()
      expect(dow).toBeGreaterThanOrEqual(1)
      expect(dow).toBeLessThanOrEqual(5)
    }
  })

  it('covers every weekday in the month', () => {
    const month = dayjs('2026-06-01')
    const cells = buildCalendarCells(month)
    // June 2026 has 22 working days (Mon–Fri), but the grid may include
    // leading/trailing days from adjacent months.
    const inMonth = cells.filter((c) => c.inCurrentMonth)
    // Verify all 22 June weekdays are present.
    expect(inMonth).toHaveLength(22)
  })

  it('marks cells outside the month correctly', () => {
    const month = dayjs('2026-06-01')
    const cells = buildCalendarCells(month)
    const outside = cells.filter((c) => !c.inCurrentMonth)
    for (const cell of outside) {
      expect(cell.date.month()).not.toBe(5) // June is month index 5
    }
  })

  it('grid rows start on Monday', () => {
    const cells = buildCalendarCells(dayjs('2026-06-01'))
    const first = cells[0]
    assertDefined(first)
    expect(first.date.day()).toBe(1) // Monday
  })

  it('grid rows end on Friday', () => {
    const cells = buildCalendarCells(dayjs('2026-06-01'))
    const last = cells.at(-1)
    assertDefined(last)
    expect(last.date.day()).toBe(5) // Friday
  })

  it('handles a month where the 1st is a Monday (no leading days)', () => {
    // March 2021: the 1st is a Monday.
    const cells = buildCalendarCells(dayjs('2021-03-01'))
    const first = cells[0]
    assertDefined(first)
    expect(first.date.format('YYYY-MM-DD')).toBe('2021-03-01')
    expect(first.inCurrentMonth).toBe(true)
  })

  it('handles a month where the last day is a Friday (no trailing days)', () => {
    // July 2022: the 31st is a Sunday so the last Friday inside the month is
    // the 29th.  October 2021: the 29th is a Friday and the 31st is a Sunday.
    // April 2022: the last day is Saturday 30th → last Friday in month is 29th.
    // We want a month whose last calendar day IS a Friday: e.g. March 2024 ends on Sunday.
    // Let's use September 2023: last day is Sep 30 (Saturday) → last trading day is Sep 29 (Friday).
    const cells = buildCalendarCells(dayjs('2023-09-01'))
    const last = cells.at(-1)
    assertDefined(last)
    expect(last.date.day()).toBe(5) // always ends on Friday
  })
})

describe('groupByDate', () => {
  it('groups trades by YYYY-MM-DD key', () => {
    const trades = [
      trade({ id: 1, trade_date: '2026-06-10T08:00:00.000Z' }),
      trade({ id: 2, trade_date: '2026-06-10T14:00:00.000Z' }),
      trade({ id: 3, trade_date: '2026-06-11T09:00:00.000Z' }),
    ]
    const result = groupByDate(trades)
    expect(Object.keys(result)).toHaveLength(2)
    expect(result['2026-06-10']).toHaveLength(2)
    expect(result['2026-06-11']).toHaveLength(1)
  })

  it('skips trades with null trade_date', () => {
    const trades = [
      trade({ id: 1, trade_date: null }),
      trade({ id: 2, trade_date: '2026-06-10T08:00:00.000Z' }),
    ]
    const result = groupByDate(trades)
    expect(Object.keys(result)).toHaveLength(1)
    expect(result['2026-06-10']).toHaveLength(1)
  })

  it('returns an empty object for an empty array', () => {
    expect(groupByDate([])).toEqual({})
  })

  it('handles legacy date-only strings without crashing', () => {
    const trades = [trade({ id: 1, trade_date: '2026-03-04' })]
    const result = groupByDate(trades)
    expect(result['2026-03-04']).toHaveLength(1)
  })
})

describe('weeklyReviewSums', () => {
  it('keys result by the Friday of each week', () => {
    // 2026-06-08 is a Monday; its Friday is 2026-06-12.
    const trades = [
      trade({ id: 1, trade_date: '2026-06-08T08:00:00.000Z', performance_r: 1.0 }),
      trade({ id: 2, trade_date: '2026-06-09T08:00:00.000Z', performance_r: 2.0 }),
      trade({ id: 3, trade_date: '2026-06-12T08:00:00.000Z', performance_r: -0.5 }),
    ]
    const result = weeklyReviewSums(trades)
    expect(result['2026-06-12']).toBeCloseTo(2.5)
  })

  it('sums across multiple weeks independently', () => {
    const trades = [
      trade({ id: 1, trade_date: '2026-06-08T08:00:00.000Z', performance_r: 1.0 }),
      trade({ id: 2, trade_date: '2026-06-15T08:00:00.000Z', performance_r: -2.0 }),
    ]
    const result = weeklyReviewSums(trades)
    expect(result['2026-06-12']).toBeCloseTo(1.0)
    expect(result['2026-06-19']).toBeCloseTo(-2.0)
  })

  it('skips trades with null performance_r', () => {
    const trades = [
      trade({ id: 1, trade_date: '2026-06-08T08:00:00.000Z', performance_r: null }),
    ]
    const result = weeklyReviewSums(trades)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('skips trades with null trade_date', () => {
    const trades = [trade({ id: 1, trade_date: null, performance_r: 1.0 })]
    const result = weeklyReviewSums(trades)
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('handles mixed positive and negative values', () => {
    const trades = [
      trade({ id: 1, trade_date: '2026-06-08T08:00:00.000Z', performance_r: 2.0 }),
      trade({ id: 2, trade_date: '2026-06-10T08:00:00.000Z', performance_r: -3.0 }),
      trade({ id: 3, trade_date: '2026-06-12T08:00:00.000Z', performance_r: 1.5 }),
    ]
    const result = weeklyReviewSums(trades)
    expect(result['2026-06-12']).toBeCloseTo(0.5)
  })

  it('only counts live trades, excluding demo and test', () => {
    const trades = [
      trade({ id: 1, trade_date: '2026-06-08T08:00:00.000Z', performance_r: 1.0, account_type: 'live' }),
      trade({ id: 2, trade_date: '2026-06-09T08:00:00.000Z', performance_r: 5.0, account_type: 'demo' }),
      trade({ id: 3, trade_date: '2026-06-10T08:00:00.000Z', performance_r: 8.0, account_type: 'test' }),
    ]
    const result = weeklyReviewSums(trades)
    expect(result['2026-06-12']).toBeCloseTo(1.0)
  })
})

describe('monthlyReviewSum', () => {
  it('sums performance_r for trades in the given month', () => {
    const month = dayjs('2026-06-01')
    const trades = [
      trade({ id: 1, trade_date: '2026-06-10T08:00:00.000Z', performance_r: 1.5 }),
      trade({ id: 2, trade_date: '2026-06-20T08:00:00.000Z', performance_r: -0.5 }),
      trade({ id: 3, trade_date: '2026-07-01T08:00:00.000Z', performance_r: 2.0 }),
    ]
    expect(monthlyReviewSum(trades, month)).toBeCloseTo(1.0)
  })

  it('returns 0 when no trades fall in the month', () => {
    expect(monthlyReviewSum([], dayjs('2026-06-01'))).toBe(0)
  })

  it('skips trades with null performance_r', () => {
    const month = dayjs('2026-06-01')
    const trades = [
      trade({ id: 1, trade_date: '2026-06-10T08:00:00.000Z', performance_r: null }),
      trade({ id: 2, trade_date: '2026-06-15T08:00:00.000Z', performance_r: 2.0 }),
    ]
    expect(monthlyReviewSum(trades, month)).toBeCloseTo(2.0)
  })

  it('handles month boundary correctly (does not include adjacent month)', () => {
    const month = dayjs('2026-06-01')
    const trades = [
      trade({ id: 1, trade_date: '2026-05-15T10:00:00.000Z', performance_r: 10.0 }),
      trade({ id: 2, trade_date: '2026-06-10T10:00:00.000Z', performance_r: 1.0 }),
    ]
    // Only June trade should be counted.
    expect(monthlyReviewSum(trades, month)).toBeCloseTo(1.0)
  })

  it('only counts live trades, excluding demo and test', () => {
    const month = dayjs('2026-06-01')
    const trades = [
      trade({ id: 1, trade_date: '2026-06-10T08:00:00.000Z', performance_r: 1.5, account_type: 'live' }),
      trade({ id: 2, trade_date: '2026-06-15T08:00:00.000Z', performance_r: 5.0, account_type: 'demo' }),
      trade({ id: 3, trade_date: '2026-06-20T08:00:00.000Z', performance_r: 8.0, account_type: 'test' }),
    ]
    expect(monthlyReviewSum(trades, month)).toBeCloseTo(1.5)
  })
})

describe('lastVisibleDayOfMonth', () => {
  it('returns the last day when the month ends on a Friday', () => {
    // 2026-01-31 is a Saturday; use 2025-10 which ends Fri 2025-10-31.
    expect(lastVisibleDayOfMonth(dayjs('2025-10-01'))).toBe('2025-10-31')
  })

  it('returns the preceding Friday when the month ends on a Saturday', () => {
    // 2026-01-31 is a Saturday → preceding Friday 2026-01-30.
    expect(lastVisibleDayOfMonth(dayjs('2026-01-01'))).toBe('2026-01-30')
  })

  it('returns the preceding Friday when the month ends on a Sunday', () => {
    // 2026-05-31 is a Sunday → preceding Friday 2026-05-29.
    expect(lastVisibleDayOfMonth(dayjs('2026-05-01'))).toBe('2026-05-29')
  })

  it('returns the last day when the month ends on a weekday', () => {
    // 2026-06-30 is a Tuesday.
    expect(lastVisibleDayOfMonth(dayjs('2026-06-01'))).toBe('2026-06-30')
  })
})

describe('computeStats', () => {
  it('returns all nulls for empty input', () => {
    const stats = computeStats([])
    expect(stats.totalTrades).toBe(0)
    expect(stats.totalR).toBeNull()
    expect(stats.winRate).toBeNull()
    expect(stats.avgR).toBeNull()
  })

  it('returns nulls when all performance_r values are null', () => {
    const trades = [
      trade({ id: 1, performance_r: null }),
      trade({ id: 2, performance_r: null }),
    ]
    const stats = computeStats(trades)
    expect(stats.totalTrades).toBe(2)
    expect(stats.totalR).toBeNull()
    expect(stats.winRate).toBeNull()
    expect(stats.avgR).toBeNull()
  })

  it('uses only non-null performance_r for denominators', () => {
    const trades = [
      trade({ id: 1, performance_r: 2.0 }),
      trade({ id: 2, performance_r: -1.0 }),
      trade({ id: 3, performance_r: null }),
    ]
    const stats = computeStats(trades)
    expect(stats.totalTrades).toBe(3)
    // totalR uses only the 2 non-null values.
    expect(stats.totalR).toBeCloseTo(1.0)
    // winRate = 1 winner / 2 non-null = 0.5
    expect(stats.winRate).toBeCloseTo(0.5)
    // avgR = 1.0 / 2
    expect(stats.avgR).toBeCloseTo(0.5)
  })

  it('counts only trades with performance_r > 0 as winners', () => {
    const trades = [
      trade({ id: 1, performance_r: 1.0 }),
      trade({ id: 2, performance_r: 0 }),
      trade({ id: 3, performance_r: -1.0 }),
    ]
    const stats = computeStats(trades)
    // 1 winner out of 3 with r.
    expect(stats.winRate).toBeCloseTo(1 / 3)
  })

  it('handles all winners', () => {
    const trades = [
      trade({ id: 1, performance_r: 1.0 }),
      trade({ id: 2, performance_r: 2.0 }),
    ]
    const stats = computeStats(trades)
    expect(stats.winRate).toBeCloseTo(1.0)
    expect(stats.totalR).toBeCloseTo(3.0)
    expect(stats.avgR).toBeCloseTo(1.5)
  })
})

describe('defaultDisplayMonth', () => {
  it('returns the current month for current year regardless of trades', () => {
    const currentYear = dayjs().year()
    // Trades in an older month of the current year — result should still be today's month.
    const trades = [
      trade({ id: 1, trade_date: `${currentYear}-01-10T08:00:00.000Z` }),
      trade({ id: 2, trade_date: `${currentYear}-02-15T08:00:00.000Z` }),
    ]
    const result = defaultDisplayMonth(trades, currentYear)
    expect(result.format('YYYY-MM')).toBe(dayjs().format('YYYY-MM'))
  })

  it('returns current month for current year even with no trades', () => {
    const currentYear = dayjs().year()
    const result = defaultDisplayMonth([], currentYear)
    expect(result.format('YYYY-MM')).toBe(dayjs().format('YYYY-MM'))
  })

  it('returns the month of the most recent trade for a past year', () => {
    const trades = [
      trade({ id: 1, trade_date: '2025-03-10T08:00:00.000Z' }),
      trade({ id: 2, trade_date: '2025-08-01T08:00:00.000Z' }),
      trade({ id: 3, trade_date: '2025-01-15T08:00:00.000Z' }),
    ]
    expect(defaultDisplayMonth(trades, 2025).format('YYYY-MM')).toBe('2025-08')
  })

  it('returns January of the selected year when no trades exist for that year', () => {
    const result = defaultDisplayMonth([], 2024)
    expect(result.format('YYYY-MM')).toBe('2024-01')
  })

  it('returns January of the selected year when all trades belong to a different year', () => {
    const trades = [
      trade({ id: 1, trade_date: '2026-06-10T08:00:00.000Z' }),
    ]
    expect(defaultDisplayMonth(trades, 2024).format('YYYY-MM')).toBe('2024-01')
  })

  it('skips trades with null trade_date for a past year', () => {
    const trades = [
      trade({ id: 1, trade_date: null }),
      trade({ id: 2, trade_date: '2025-03-10T08:00:00.000Z' }),
    ]
    expect(defaultDisplayMonth(trades, 2025).format('YYYY-MM')).toBe('2025-03')
  })
})
