import { api } from '@/services/api'
import type { NewsEvent, SyncResult, SyncStatus } from '@/types/news'

/** API client for economic-news sync state and manual sync (issue #161). */
export const newsApi = {
  status: (signal?: AbortSignal): Promise<SyncStatus> =>
    api.get<SyncStatus>('/news/status', signal),
  sync: (): Promise<SyncResult> => api.post<SyncResult>('/news/sync'),
  list: (start: string, end: string, signal?: AbortSignal): Promise<NewsEvent[]> =>
    api.get<NewsEvent[]>(`/news?start=${start}&end=${end}`, signal),
}
