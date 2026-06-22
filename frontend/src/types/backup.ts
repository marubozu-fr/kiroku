/** Result of a successful `POST /api/backup` — a backup written to disk. */
export interface BackupResult {
  filename: string
  path: string
  created_at: string
  trades_count: number
  screenshots_count: number
}

/**
 * Metadata read from an uploaded backup archive, returned by both
 * `POST /api/backup/validate` and `POST /api/backup/restore`.
 */
export interface BackupMetadata {
  version: string
  created_at: string
  trades_count: number
  screenshots_count: number
  has_screenshots: boolean
}
