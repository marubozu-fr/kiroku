import { api } from '@/services/api'
import type {
  AnalyticsBreakdownsResponse,
  AnalyticsFilters,
  AnalyticsStatisticsResponse,
  AnalyticsTradesResponse,
} from '@/types/analytics'

/**
 * Turn an `AnalyticsFilters` object into `URLSearchParams` entries.
 *
 * Array filters (asset_ids, tag_ids, emotion_ids, entry_timeframe, types) are
 * joined as comma-separated strings — the backend's `filter_params` dependency
 * expects `Optional[str]` and splits on commas.
 * Undefined / empty values are omitted entirely.
 */
function filtersToParams(filters: AnalyticsFilters): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.asset_ids && filters.asset_ids.length > 0) {
    params.set('asset_ids', filters.asset_ids.join(','))
  }
  if (filters.direction) params.set('direction', filters.direction)
  if (filters.entry_timeframe && filters.entry_timeframe.length > 0) {
    params.set('entry_timeframe', filters.entry_timeframe.join(','))
  }
  if (filters.tag_ids && filters.tag_ids.length > 0) {
    params.set('tag_ids', filters.tag_ids.join(','))
  }
  if (filters.tags_logic) params.set('tags_logic', filters.tags_logic)
  if (filters.emotion_ids && filters.emotion_ids.length > 0) {
    params.set('emotion_ids', filters.emotion_ids.join(','))
  }
  if (filters.types && filters.types.length > 0) {
    params.set('types', filters.types.join(','))
  }
  if (filters.include_missed !== undefined) {
    params.set('include_missed', String(filters.include_missed))
  }
  if (filters.pnl_operator) params.set('pnl_operator', filters.pnl_operator)
  if (filters.pnl_value !== undefined) params.set('pnl_value', String(filters.pnl_value))
  if (filters.duration_operator) params.set('duration_operator', filters.duration_operator)
  if (filters.duration_value !== undefined) {
    params.set('duration_value', String(filters.duration_value))
  }
  if (filters.duration_unit) params.set('duration_unit', filters.duration_unit)

  return params
}

/** Fetch aggregate KPI statistics for the given filters. */
export function fetchStatistics(
  filters: AnalyticsFilters,
  signal?: AbortSignal,
): Promise<AnalyticsStatisticsResponse> {
  const params = filtersToParams(filters)
  const qs = params.toString()
  return api.get<AnalyticsStatisticsResponse>(
    `/analytics/statistics${qs ? `?${qs}` : ''}`,
    signal,
  )
}

/** Fetch the paginated trade list for the given filters. */
export function fetchTrades(
  filters: AnalyticsFilters,
  page: number,
  perPage: number,
  signal?: AbortSignal,
): Promise<AnalyticsTradesResponse> {
  const params = filtersToParams(filters)
  params.set('page', String(page))
  params.set('per_page', String(perPage))
  return api.get<AnalyticsTradesResponse>(`/analytics/trades?${params.toString()}`, signal)
}

/** Fetch chart breakdown data for the given filters. */
export function fetchBreakdowns(
  filters: AnalyticsFilters,
  signal?: AbortSignal,
): Promise<AnalyticsBreakdownsResponse> {
  const params = filtersToParams(filters)
  const qs = params.toString()
  return api.get<AnalyticsBreakdownsResponse>(
    `/analytics/breakdowns${qs ? `?${qs}` : ''}`,
    signal,
  )
}
