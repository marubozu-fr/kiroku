import dayjs from 'dayjs'
import i18n from '@/i18n'
import type { AccountType, TradeDirection, TradeStatus } from '@/types/trade'

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

/** Format an R multiple with an explicit sign and suffix, e.g. `+1.50R`. */
export function formatR(value: number | null): string {
  if (value === null) {
    return '—'
  }
  return `${value > 0 ? '+' : ''}${formatDecimal(value)}R`
}

/** Format a percentage with an explicit sign and suffix, e.g. `+5.00%`. */
export function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${formatDecimal(value)}%`
}

/**
 * Format the journal P&L display: the signed R multiple, followed by the
 * equivalent percentage (`performance_r × risk_per_trade`) in parentheses when
 * the trade's risk-per-trade is known, e.g. `+2.50R (+5.00%)`. Falls back to
 * the R multiple alone (`+2.50R`) when risk-per-trade is unset, and to an em
 * dash when there is no R yet (open trades / missed opportunities).
 */
export function formatPnl(
  performanceR: number | null,
  riskPerTrade: number | null,
): string {
  if (performanceR === null) {
    return '—'
  }
  const r = formatR(performanceR)
  if (riskPerTrade === null) {
    return r
  }
  return `${r} (${formatPercent(performanceR * riskPerTrade)})`
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

/** Mantine badge colour for a trade direction (no green/red — reserved for P&L). */
export const DIRECTION_COLOR: Record<TradeDirection, string> = {
  Long: 'teal',
  Short: 'grape',
}

/** Mantine badge colour for a trade status (no green/red — reserved for P&L). */
export const STATUS_COLOR: Record<TradeStatus, string> = {
  Open: 'blue',
  Closed: 'gray',
  Partial: 'cyan',
  Breakeven: 'gray',
}

/**
 * Mantine badge colour for an account type. Live reads as the brand primary
 * (blue); Demo/Test use the indigo "supplementary" hue and neutral gray so they
 * read as system tags that carry no financial semantic.
 */
export const ACCOUNT_COLOR: Record<AccountType, string> = {
  live: 'blue',
  demo: 'indigo',
  test: 'gray',
}

/**
 * Mantine colour token for a trade's P&L, adjusted for account type. Live keeps
 * the full green/red/dimmed semantic. Demo fades the tint (still legible). Test
 * strips the colour to neutral — throwaway data loses all P&L emphasis.
 */
export function accountSignedColor(
  value: number | null,
  accountType: AccountType,
): string | undefined {
  if (accountType === 'test') {
    return 'dimmed'
  }
  const base = signedColor(value)
  if (accountType === 'demo') {
    if (base === 'green.6') return 'green.4'
    if (base === 'red.6') return 'red.4'
  }
  return base
}
