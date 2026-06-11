import { api } from '@/services/api'
import type { ProjectionFilters, Projections } from '@/types/projections'

/**
 * Turn a `ProjectionFilters` object into `URLSearchParams` entries.
 *
 * `assets` is joined as a comma-separated string — the backend expects
 * `Optional[str]` and splits on commas. Undefined / empty values are omitted.
 */
function filtersToParams(filters: ProjectionFilters): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.start_date) params.set('start_date', filters.start_date)
  if (filters.assets && filters.assets.length > 0) {
    params.set('assets', filters.assets.join(','))
  }
  if (filters.goal_r !== undefined) {
    params.set('goal_r', String(filters.goal_r))
  }

  return params
}

/** Fetch Monte Carlo projections for the given filters. */
export function fetchProjections(
  filters: ProjectionFilters,
  signal?: AbortSignal,
): Promise<Projections> {
  const params = filtersToParams(filters)
  const qs = params.toString()
  return api.get<Projections>(`/projections${qs ? `?${qs}` : ''}`, signal)
}
