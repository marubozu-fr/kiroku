import { api } from '@/services/api'
import type { TickerSearchResult } from '@/types/massive'

/** Markets accepted by the Massive reference search. */
export type MassiveMarket = 'fx' | 'stocks' | 'crypto'

/** API client for Massive market-data lookups (issue #187). */
export const massiveApi = {
  searchTickers: (
    search: string,
    market: MassiveMarket = 'fx',
    signal?: AbortSignal,
  ): Promise<TickerSearchResult[]> =>
    api.get<TickerSearchResult[]>(
      `/massive/tickers?search=${encodeURIComponent(search)}&market=${market}`,
      signal,
    ),
}
