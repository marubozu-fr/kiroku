/** News sync state returned by `GET /api/news/status` (issue #161). */
export interface SyncStatus {
  last_sync: string | null
  is_stale: boolean
}

/** Result of a manual sync via `POST /api/news/sync`. */
export interface SyncResult {
  synced: number
  week_start: string | null
  week_end: string | null
}

/** Normalized impact level of an economic calendar event. */
export type NewsImpact = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'

/** A macro economic calendar event from `GET /api/news` (issue #162). */
export interface NewsEvent {
  id: string
  date: string
  title: string
  currency: string
  impact: NewsImpact
  forecast: string
  previous: string
}
