import { api } from '@/services/api'
import type { DashboardData } from '@/types/dashboard'

/**
 * API client for the dashboard.
 *
 * `period` selects the time window (`ytd` | `1y` | `5y` | `all`);
 * `accountType` filters by account (`all` disables the filter; the page
 * passes `all` so imported trades of any account type are included).
 */
export function fetchDashboard(
  period: string,
  accountType = 'live',
  signal?: AbortSignal,
): Promise<DashboardData> {
  const params = new URLSearchParams({ period, account_type: accountType })
  return api.get<DashboardData>(`/dashboard?${params.toString()}`, signal)
}
