import { api } from '@/services/api'
import type { TradeSummary } from '@/types/trade'

/**
 * API client for trades. The journal list page reads the years that have
 * trades to populate its selector, then fetches the summaries for the
 * selected year.
 */
export const tradesApi = {
  list: (year: number, signal?: AbortSignal): Promise<TradeSummary[]> =>
    api.get<TradeSummary[]>(`/trades?year=${year}`, signal),
  years: (signal?: AbortSignal): Promise<number[]> =>
    api.get<number[]>('/trades/years', signal),
}
