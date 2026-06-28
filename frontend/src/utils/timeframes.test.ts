import { describe, expect, it } from 'vitest'
import type { ChartTimeframe } from '@/types/preferences'
import { compareTimeframes, formatTimeframe, sortTimeframes } from './timeframes'

describe('formatTimeframe', () => {
  it('concatenates value and unit', () => {
    expect(formatTimeframe({ value: 15, unit: 'm' })).toBe('15m')
    expect(formatTimeframe({ value: 1, unit: 'D' })).toBe('1D')
    expect(formatTimeframe({ value: 1, unit: 'W' })).toBe('1W')
  })
})

describe('sortTimeframes', () => {
  it('sorts ascending by unit weight then value', () => {
    const input: ChartTimeframe[] = [
      { value: 1, unit: 'W' },
      { value: 4, unit: 'h' },
      { value: 15, unit: 'm' },
      { value: 1, unit: 'D' },
      { value: 1, unit: 'h' },
      { value: 1, unit: 'm' },
      { value: 5, unit: 'm' },
    ]
    expect(sortTimeframes(input).map(formatTimeframe)).toEqual([
      '1m',
      '5m',
      '15m',
      '1h',
      '4h',
      '1D',
      '1W',
    ])
  })

  it('does not mutate the input array', () => {
    const input: ChartTimeframe[] = [
      { value: 4, unit: 'h' },
      { value: 1, unit: 'm' },
    ]
    sortTimeframes(input)
    expect(input.map(formatTimeframe)).toEqual(['4h', '1m'])
  })
})

describe('compareTimeframes', () => {
  it('orders minutes before hours before days before weeks', () => {
    expect(compareTimeframes({ value: 1, unit: 'm' }, { value: 1, unit: 'h' })).toBeLessThan(0)
    expect(compareTimeframes({ value: 1, unit: 'h' }, { value: 1, unit: 'D' })).toBeLessThan(0)
    expect(compareTimeframes({ value: 1, unit: 'D' }, { value: 1, unit: 'W' })).toBeLessThan(0)
  })

  it('orders by value within the same unit', () => {
    expect(compareTimeframes({ value: 5, unit: 'm' }, { value: 15, unit: 'm' })).toBeLessThan(0)
  })
})
