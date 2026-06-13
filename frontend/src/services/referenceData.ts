import { api } from '@/services/api'
import type {
  Asset,
  AssetInput,
  Emotion,
  EmotionInput,
  Tag,
  TagInput,
  TradeCount,
} from '@/types/referenceData'

/**
 * API clients for the Settings page reference data.
 *
 * Activation is toggled with a plain `update` (`is_active: true | false`).
 * `remove` is a hard delete (HTTP 204): for tags and emotions it cascades
 * (the entity is detached from any trades referencing it); for assets it is
 * guarded server-side and refused while trades still reference the asset.
 * `tradeCount` reports how many trades reference an entity so the UI can pick
 * the right confirmation modal before deleting.
 */

export const assetsApi = {
  list: (signal?: AbortSignal): Promise<Asset[]> =>
    api.get<Asset[]>('/assets', signal),
  create: (body: AssetInput): Promise<Asset> => api.post<Asset>('/assets', body),
  update: (
    id: number,
    body: Partial<AssetInput> & { is_active?: boolean },
  ): Promise<Asset> => api.put<Asset>(`/assets/${id}`, body),
  remove: (id: number): Promise<void> => api.delete<void>(`/assets/${id}`),
  tradeCount: (id: number, signal?: AbortSignal): Promise<TradeCount> =>
    api.get<TradeCount>(`/assets/${id}/trade-count`, signal),
}

export const tagsApi = {
  list: (signal?: AbortSignal): Promise<Tag[]> => api.get<Tag[]>('/tags', signal),
  create: (body: TagInput): Promise<Tag> => api.post<Tag>('/tags', body),
  update: (
    id: number,
    body: Partial<TagInput> & { is_active?: boolean },
  ): Promise<Tag> => api.put<Tag>(`/tags/${id}`, body),
  remove: (id: number): Promise<void> => api.delete<void>(`/tags/${id}`),
  tradeCount: (id: number, signal?: AbortSignal): Promise<TradeCount> =>
    api.get<TradeCount>(`/tags/${id}/trade-count`, signal),
}

export const emotionsApi = {
  grouped: (signal?: AbortSignal): Promise<Record<string, Emotion[]>> =>
    api.get<Record<string, Emotion[]>>('/emotions/grouped', signal),
  create: (body: EmotionInput): Promise<Emotion> =>
    api.post<Emotion>('/emotions', body),
  bulkCreate: (emotions: EmotionInput[]): Promise<Emotion[]> =>
    api.post<Emotion[]>('/emotions/bulk', { emotions }),
  update: (id: number, body: Partial<EmotionInput>): Promise<Emotion> =>
    api.put<Emotion>(`/emotions/${id}`, body),
  remove: (id: number): Promise<void> => api.delete<void>(`/emotions/${id}`),
  tradeCount: (id: number, signal?: AbortSignal): Promise<TradeCount> =>
    api.get<TradeCount>(`/emotions/${id}/trade-count`, signal),
}
