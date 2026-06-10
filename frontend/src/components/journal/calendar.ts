/**
 * Pure date/grid math for the Journal Calendar view.
 *
 * All functions are side-effect free and work only on plain values so they can
 * be imported by both React components and unit tests without rendering.
 */
import dayjs, { type Dayjs } from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import type { TradeSummary } from '@/types/trade'

// Register the isoWeek plugin so .isoWeekday(), .startOf('isoWeek') etc. work.
dayjs.extend(isoWeek)

/** A single cell rendered in the Mon–Fri calendar grid. */
export interface CalendarCell {
  /** The calendar date this cell represents (start of day). */
  date: Dayjs
  /** Whether this date falls within the displayed month. */
  inCurrentMonth: boolean
}

/**
 * Returns all Mon–Fri cells that are needed to display a given month,
 * including leading/trailing days from adjacent months to fill the week rows.
 *
 * A "week row" starts on Monday and ends on Friday. The first row contains
 * the Monday of the week that includes the 1st of the month; the last row
 * contains the Friday of the week that includes the last day of the month.
 */
export function buildCalendarCells(month: Dayjs): CalendarCell[] {
  const firstOfMonth = month.startOf('month')
  const lastOfMonth = month.endOf('month')

  // Monday of the ISO week containing the 1st of the month.
  const startMonday = firstOfMonth.startOf('isoWeek')
  // Friday of the ISO week containing the last day of the month.
  // isoWeek ends on Sunday; subtract 2 days to get Friday.
  const endFriday = lastOfMonth.endOf('isoWeek').subtract(2, 'day')

  const cells: CalendarCell[] = []
  let current = startMonday

  while (current.isBefore(endFriday) || current.isSame(endFriday, 'day')) {
    const dow = current.day() // 0=Sun 1=Mon … 6=Sat
    if (dow >= 1 && dow <= 5) {
      cells.push({
        date: current,
        inCurrentMonth: current.month() === month.month() && current.year() === month.year(),
      })
    }
    current = current.add(1, 'day')
  }

  return cells
}

/**
 * Groups trades by `YYYY-MM-DD`, skipping entries with a null `trade_date`.
 * Returns a plain object map (key = ISO date string, value = trade array).
 */
export function groupByDate(trades: TradeSummary[]): Record<string, TradeSummary[]> {
  const map: Record<string, TradeSummary[]> = {}
  for (const trade of trades) {
    if (!trade.trade_date) {
      continue
    }
    const key = dayjs(trade.trade_date).format('YYYY-MM-DD')
    if (!map[key]) {
      map[key] = []
    }
    map[key].push(trade)
  }
  return map
}

/**
 * Computes the sum of non-null `performance_r` values for a Mon–Fri week,
 * keyed by the **Friday** date of that week in `YYYY-MM-DD` format.
 *
 * Only weeks that have at least one trade with non-null performance_r
 * are included.
 */
export function weeklyReviewSums(trades: TradeSummary[]): Record<string, number> {
  const weekMap: Record<string, number[]> = {}
  for (const trade of trades) {
    if (!trade.trade_date || trade.performance_r === null) {
      continue
    }
    const d = dayjs(trade.trade_date)
    // Friday of the same ISO week: end of ISO week is Sunday, subtract 2 days.
    const friday = d.endOf('isoWeek').subtract(2, 'day')
    const key = friday.format('YYYY-MM-DD')
    if (!weekMap[key]) {
      weekMap[key] = []
    }
    weekMap[key].push(trade.performance_r)
  }

  const result: Record<string, number> = {}
  for (const [key, values] of Object.entries(weekMap)) {
    result[key] = values.reduce((a, b) => a + b, 0)
  }
  return result
}

/**
 * Computes the sum of all non-null `performance_r` values for the trades
 * belonging to a given month (year + month index, 0-based as in dayjs).
 */
export function monthlyReviewSum(trades: TradeSummary[], month: Dayjs): number {
  let sum = 0
  for (const trade of trades) {
    if (!trade.trade_date || trade.performance_r === null) {
      continue
    }
    const d = dayjs(trade.trade_date)
    if (d.year() === month.year() && d.month() === month.month()) {
      sum += trade.performance_r
    }
  }
  return sum
}

/**
 * Identifies the last trading day (Mon–Fri) within a month that has at least
 * one trade. Returns the date string `YYYY-MM-DD`, or null if no trades fall
 * in this month.
 */
export function lastTradingDayOfMonth(
  trades: TradeSummary[],
  month: Dayjs,
): string | null {
  let last: Dayjs | null = null
  for (const trade of trades) {
    if (!trade.trade_date) {
      continue
    }
    const d = dayjs(trade.trade_date)
    if (d.year() !== month.year() || d.month() !== month.month()) {
      continue
    }
    const dow = d.day()
    if (dow === 0 || dow === 6) {
      continue // skip weekends
    }
    if (last === null || d.isAfter(last, 'day')) {
      last = d
    }
  }
  return last ? last.format('YYYY-MM-DD') : null
}

/** Aggregated statistics computed from a list of trades. */
export interface TradeStats {
  totalTrades: number
  totalR: number | null
  winRate: number | null
  avgR: number | null
}

/**
 * Computes journal summary stats from a list of `TradeSummary` values.
 *
 * - `totalTrades`: raw count including trades with null `performance_r`.
 * - `totalR`: sum of non-null `performance_r`; null when none are available.
 * - `winRate`: winners / count-with-r (0..1); null when denominator is 0.
 * - `avgR`: totalR / count-with-r; null when denominator is 0.
 */
export function computeStats(trades: TradeSummary[]): TradeStats {
  const totalTrades = trades.length
  const withR = trades.filter((t) => t.performance_r !== null)

  if (withR.length === 0) {
    return { totalTrades, totalR: null, winRate: null, avgR: null }
  }

  const totalR = withR.reduce((sum, t) => sum + (t.performance_r as number), 0)
  const winners = withR.filter((t) => (t.performance_r as number) > 0).length
  const winRate = winners / withR.length
  const avgR = totalR / withR.length

  return { totalTrades, totalR, winRate, avgR }
}

/**
 * Returns the most recent month that has at least one trade in the dataset,
 * or the current month when the dataset is empty.
 */
export function defaultDisplayMonth(trades: TradeSummary[]): Dayjs {
  let latest: Dayjs | null = null
  for (const trade of trades) {
    if (!trade.trade_date) {
      continue
    }
    const d = dayjs(trade.trade_date)
    if (latest === null || d.isAfter(latest)) {
      latest = d
    }
  }
  return latest ? latest.startOf('month') : dayjs().startOf('month')
}
