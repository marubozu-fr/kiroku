import { api } from '@/services/api'
import type { DashboardData } from '@/types/dashboard'

/**
 * API client for the dashboard.
 *
 * `period` selects the time window (`ytd` | `1y` | `5y` | `all`);
 * `accountType` filters by account (`live` by default, matching the page).
 */
export function fetchDashboard(
  period: string,
  accountType = 'live',
  signal?: AbortSignal,
): Promise<DashboardData> {
  const params = new URLSearchParams({ period, account_type: accountType })
  return api.get<DashboardData>(`/dashboard?${params.toString()}`, signal)
}
