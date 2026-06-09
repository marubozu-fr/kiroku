import { api } from '@/services/api'
import type {
  Asset,
  AssetInput,
  Emotion,
  EmotionInput,
  Tag,
  TagInput,
} from '@/types/referenceData'

/**
 * API clients for the Settings page reference data.
 *
 * Assets and tags use a soft-delete model: `deactivate` calls DELETE (which
 * flips `is_active` to false) and reactivation is a plain update with
 * `is_active: true`. Emotions are hard-deleted via `remove`.
 */

export const assetsApi = {
  list: (signal?: AbortSignal): Promise<Asset[]> =>
    api.get<Asset[]>('/assets', signal),
  create: (body: AssetInput): Promise<Asset> => api.post<Asset>('/assets', body),
  update: (
    id: number,
    body: Partial<AssetInput> & { is_active?: boolean },
  ): Promise<Asset> => api.put<Asset>(`/assets/${id}`, body),
  deactivate: (id: number): Promise<Asset> => api.delete<Asset>(`/assets/${id}`),
}

export const tagsApi = {
  list: (signal?: AbortSignal): Promise<Tag[]> => api.get<Tag[]>('/tags', signal),
  create: (body: TagInput): Promise<Tag> => api.post<Tag>('/tags', body),
  update: (
    id: number,
    body: Partial<TagInput> & { is_active?: boolean },
  ): Promise<Tag> => api.put<Tag>(`/tags/${id}`, body),
  deactivate: (id: number): Promise<Tag> => api.delete<Tag>(`/tags/${id}`),
}

export const emotionsApi = {
  grouped: (signal?: AbortSignal): Promise<Record<string, Emotion[]>> =>
    api.get<Record<string, Emotion[]>>('/emotions/grouped', signal),
  create: (body: EmotionInput): Promise<Emotion> =>
    api.post<Emotion>('/emotions', body),
  update: (id: number, body: Partial<EmotionInput>): Promise<Emotion> =>
    api.put<Emotion>(`/emotions/${id}`, body),
  remove: (id: number): Promise<Emotion> => api.delete<Emotion>(`/emotions/${id}`),
}
