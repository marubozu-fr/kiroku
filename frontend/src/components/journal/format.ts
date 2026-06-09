import dayjs from 'dayjs'
import i18n from '@/i18n'
import type { TradeStatus } from '@/types/trade'

/**
 * Formatting helpers for the journal table.
 *
 * Per docs/DESIGN_SYSTEM.md, financial numbers always show their sign and are
 * coloured with semantic tokens: green for gains, red for losses, dimmed for
 * neutral / missing values. Direction and status badges are deliberately kept
 * off green/red — those colours are reserved for P&L and win/loss.
 *
 * Numbers and dates render in the active i18n locale so they match the user's
 * language: decimal/thousands separators via `Intl.NumberFormat`, and
 * localized date formats via dayjs (its locale is kept in sync in `@/i18n`).
 */

/** Active i18n locale (e.g. `fr`, `en-US`), defaulting to `en`. */
function activeLocale(): string {
  return i18n.language || 'en'
}

/** Locale-aware decimal formatter with a fixed two-digit fraction. */
function formatDecimal(value: number): string {
  return new Intl.NumberFormat(activeLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

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
  return `${value > 0 ? '+' : ''}${formatDecimal(value)}`
}

/** Format an R multiple with an explicit sign and suffix, e.g. `+1.50R`. */
export function formatR(value: number | null): string {
  if (value === null) {
    return '—'
  }
  return `${value > 0 ? '+' : ''}${formatDecimal(value)}R`
}

/**
 * Show the calendar date of an ISO timestamp in the active locale's format.
 * Defaults to dayjs `LL` (long date, e.g. `September 4, 1986` / `4 septembre 1986`).
 */
export function formatLocalDate(value: string | null, format = 'LL'): string {
  if (!value) {
    return '—'
  }
  return dayjs(value).format(format)
}

/** Mantine badge colour for a trade status (no green/red — reserved for P&L). */
export const STATUS_COLOR: Record<TradeStatus, string> = {
  Open: 'blue',
  Closed: 'gray',
  Partial: 'cyan',
  Breakeven: 'gray',
}
