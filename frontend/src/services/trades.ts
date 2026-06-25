import { api, ApiError, API_BASE } from '@/services/api'
import type {
  ScreenshotUploadInput,
  TradeDetail,
  TradeInput,
  TradeScreenshot,
  TradeSummary,
} from '@/types/trade'
import type { TradeCandlesResponse } from '@/types/candle'

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
  get: (id: number, signal?: AbortSignal): Promise<TradeDetail> =>
    api.get<TradeDetail>(`/trades/${id}`, signal),
  create: (body: TradeInput): Promise<TradeDetail> =>
    api.post<TradeDetail>('/trades', body),
  update: (id: number, body: TradeInput): Promise<TradeDetail> =>
    api.put<TradeDetail>(`/trades/${id}`, body),
  remove: (id: number): Promise<TradeDetail> =>
    api.delete<TradeDetail>(`/trades/${id}`),
  uploadScreenshot: (
    tradeId: number,
    file: File,
    meta: ScreenshotUploadInput,
  ): Promise<TradeScreenshot> => {
    const body = new FormData()
    body.append('file', file)
    body.append('timeframe_unit', meta.timeframe_unit)
    body.append('timeframe_value', String(meta.timeframe_value))
    if (meta.label !== null) {
      body.append('label', meta.label)
    }
    return api.postForm<TradeScreenshot>(`/trades/${tradeId}/screenshots`, body)
  },
  removeScreenshot: (screenshotId: number): Promise<TradeScreenshot> =>
    api.delete<TradeScreenshot>(`/screenshots/${screenshotId}`),
  candles: async (
    id: number,
    resolution?: string,
    signal?: AbortSignal,
  ): Promise<TradeCandlesResponse> => {
    const url =
      resolution !== undefined
        ? `${API_BASE}/trades/${id}/candles?resolution=${resolution}`
        : `${API_BASE}/trades/${id}/candles`

    let response: Response
    try {
      response = await fetch(url, { signal })
    } catch (cause) {
      throw new ApiError(
        cause instanceof Error ? cause.message : 'Network request failed',
        0,
      )
    }

    let payload: TradeCandlesResponse
    try {
      payload = (await response.json()) as TradeCandlesResponse
    } catch {
      throw new ApiError('Invalid JSON response from server', response.status)
    }

    if (!response.ok || payload.error !== null) {
      throw new ApiError(
        payload.error ?? `Request failed with status ${response.status}`,
        response.status,
      )
    }

    return payload
  },
}
