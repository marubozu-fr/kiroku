/**
 * Domain types for Massive market-data lookups.
 *
 * Field names mirror the API's snake_case JSON so responses map directly.
 */

/** A single ticker match returned by `GET /api/massive/tickers`. */
export interface TickerSearchResult {
  ticker: string
  name: string | null
  market: string | null
  active: boolean | null
}
