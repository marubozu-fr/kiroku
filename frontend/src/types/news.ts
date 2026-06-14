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
