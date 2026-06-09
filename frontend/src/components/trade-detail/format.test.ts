import { describe, expect, it } from 'vitest'
import { formatTradeDuration, formatTimeframeGroup } from '@/components/trade-detail/format'
import type { TradeActivity } from '@/types/trade'

function activity(date: string, overrides: Partial<TradeActivity> = {}): TradeActivity {
  return {
    id: 1,
    trade_id: 1,
    type: 'Buy',
    price: 1.1000,
    quantity: 1000,
    date,
    is_entry: true,
    ...overrides,
  }
}

describe('formatTradeDuration', () => {
  it('returns — for an empty activity list', () => {
    expect(formatTradeDuration([])).toBe('—')
  })

  it('returns — for a single activity', () => {
    expect(formatTradeDuration([activity('2026-03-01T10:00:00Z')])).toBe('—')
  })

  it('returns — for two activities with identical timestamps', () => {
    const ts = '2026-03-01T10:00:00Z'
    expect(formatTradeDuration([activity(ts), activity(ts, { id: 2 })])).toBe('—')
  })

  it('computes days + hours, omitting minutes, when duration spans multiple days', () => {
    // 2d 4h gap: 2026-03-01T10:00 → 2026-03-03T14:00
    const result = formatTradeDuration([
      activity('2026-03-01T10:00:00Z', { id: 1 }),
      activity('2026-03-03T14:00:00Z', { id: 2 }),
    ])
    expect(result).toBe('2d 4h')
  })

  it('computes hours + minutes for a same-day gap', () => {
    // 3h 15m: 10:00 → 13:15
    const result = formatTradeDuration([
      activity('2026-03-01T10:00:00Z', { id: 1 }),
      activity('2026-03-01T13:15:00Z', { id: 2 }),
    ])
    expect(result).toBe('3h 15m')
  })

  it('computes minutes only for a sub-hour gap', () => {
    // 45m: 10:00 → 10:45
    const result = formatTradeDuration([
      activity('2026-03-01T10:00:00Z', { id: 1 }),
      activity('2026-03-01T10:45:00Z', { id: 2 }),
    ])
    expect(result).toBe('45m')
  })

  it('returns < 1m for a sub-minute gap', () => {
    // 30 seconds apart
    const result = formatTradeDuration([
      activity('2026-03-01T10:00:00Z', { id: 1 }),
      activity('2026-03-01T10:00:30Z', { id: 2 }),
    ])
    expect(result).toBe('< 1m')
  })

  it('uses earliest and latest when more than two activities are provided', () => {
    // earliest: 10:00, middle: 11:00, latest: 12:30 → 2h 30m
    const result = formatTradeDuration([
      activity('2026-03-01T11:00:00Z', { id: 2 }),
      activity('2026-03-01T10:00:00Z', { id: 1 }),
      activity('2026-03-01T12:30:00Z', { id: 3, type: 'Sell', is_entry: false }),
    ])
    expect(result).toBe('2h 30m')
  })

  it('omits the minutes part when duration has days > 0', () => {
    // 1d 2h 45m gap — minutes must be omitted per implementation rule (days > 0)
    const result = formatTradeDuration([
      activity('2026-03-01T08:00:00Z', { id: 1 }),
      activity('2026-03-02T10:45:00Z', { id: 2 }),
    ])
    // 26h 45m total → 1d 2h (minutes dropped because days > 0)
    expect(result).toBe('1d 2h')
  })
})

describe('formatTimeframeGroup', () => {
  it('formats a minute timeframe', () => {
    expect(formatTimeframeGroup(15, 'm')).toBe('15m')
  })

  it('formats an hour timeframe', () => {
    expect(formatTimeframeGroup(4, 'h')).toBe('4h')
  })

  it('formats a daily timeframe', () => {
    expect(formatTimeframeGroup(1, 'd')).toBe('1d')
  })

  it('returns Untagged when both value and unit are null', () => {
    expect(formatTimeframeGroup(null, null)).toBe('Untagged')
  })

  it('returns Untagged when value is null and unit is provided', () => {
    expect(formatTimeframeGroup(null, 'm')).toBe('Untagged')
  })

  it('returns Untagged when unit is null and value is provided', () => {
    expect(formatTimeframeGroup(15, null)).toBe('Untagged')
  })
})
