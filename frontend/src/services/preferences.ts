import { api } from '@/services/api'
import type { Preferences, PreferencesUpdate } from '@/types/preferences'

/** API client for application-level business preferences (issue #62). */
export const preferencesApi = {
  get: (signal?: AbortSignal): Promise<Preferences> =>
    api.get<Preferences>('/preferences', signal),
  update: (body: PreferencesUpdate): Promise<Preferences> =>
    api.patch<Preferences>('/preferences', body),
}
