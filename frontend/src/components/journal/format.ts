import type { TradeStatus } from '@/types/trade'

/**
 * Formatting helpers for the journal table.
 *
 * Per docs/DESIGN_SYSTEM.md, financial numbers always show their sign and are
 * coloured with semantic tokens: green for gains, red for losses, dimmed for
 * neutral / missing values. Direction and status badges are deliberately kept
 * off green/red — those colours are reserved for P&L and win/loss.
 */

/** Mantine colour token for a signed value, or `undefined` for neutral. */
export function signedColor(value: number | null): string | undefined {
  if (value === null || value === 0) {
    return 'dimmed'
  }
  return value > 0 ? 'green.6' : 'red.6'
}

/** Format a P&L value with an explicit sign, e.g. `+125.00` / `-42.50`. */
export function formatPnl(value: number | null): string {
  if (value === null) {
    return '—'
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}

/** Format an R multiple with an explicit sign and suffix, e.g. `+1.50R`. */
export function formatR(value: number | null): string {
  if (value === null) {
    return '—'
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}R`
}

/** Show the calendar date portion of an ISO timestamp. */
export function formatDate(value: string | null): string {
  if (!value) {
    return '—'
  }
  return value.slice(0, 10)
}

/** Mantine badge colour for a trade status (no green/red — reserved for P&L). */
export const STATUS_COLOR: Record<TradeStatus, string> = {
  Open: 'blue',
  Closed: 'gray',
  Partial: 'cyan',
  Breakeven: 'gray',
}
