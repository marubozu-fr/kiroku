import type { ChartTimeframe } from '@/types/preferences'

/**
 * Selectable timeframe units in TradingView casing. Exact casing matters: it
 * is sent verbatim to the API. Order matches the ascending sort weight.
 */
export const TIMEFRAME_UNITS = ['m', 'h', 'D', 'W'] as const

export type TimeframeUnit = (typeof TIMEFRAME_UNITS)[number]

// Ascending sort weight: minutes < hours < days < weeks.
const UNIT_WEIGHT: Record<string, number> = { m: 0, h: 1, D: 2, W: 3 }

/** Compare two timeframes ascending: by unit weight, then by value. */
export function compareTimeframes(a: ChartTimeframe, b: ChartTimeframe): number {
  const weightA = UNIT_WEIGHT[a.unit] ?? Number.MAX_SAFE_INTEGER
  const weightB = UNIT_WEIGHT[b.unit] ?? Number.MAX_SAFE_INTEGER
  if (weightA !== weightB) {
    return weightA - weightB
  }
  return a.value - b.value
}

/** Return a new list sorted ascending (e.g. `1m, 5m, 15m, 1h, 4h, 1D, 1W`). */
export function sortTimeframes(list: ChartTimeframe[]): ChartTimeframe[] {
  return [...list].sort(compareTimeframes)
}

/** Build the display/identity label for a timeframe (e.g. `"15m"`, `"1D"`). */
export function formatTimeframe(timeframe: ChartTimeframe): string {
  return `${timeframe.value}${timeframe.unit}`
}
