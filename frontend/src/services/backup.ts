import { api } from '@/services/api'
import type { BackupMetadata, BackupResult } from '@/types/backup'

/**
 * API client for backup & restore. `validate` and `restore` send multipart
 * uploads, so they reuse the shared `postForm` helper (same pattern as
 * screenshot uploads in `services/trades.ts`).
 */
export const backupApi = {
  create: (): Promise<BackupResult> => api.post<BackupResult>('/backup', {}),
  validate: (file: File): Promise<BackupMetadata> => {
    const body = new FormData()
    body.append('file', file)
    return api.postForm<BackupMetadata>('/backup/validate', body)
  },
  restore: (file: File): Promise<BackupMetadata> => {
    const body = new FormData()
    body.append('file', file)
    return api.postForm<BackupMetadata>('/backup/restore', body)
  },
}
