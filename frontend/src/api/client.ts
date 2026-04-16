import type { MediaFile, Playlist, PlaylistItem, Screen } from './types'
import { getAccessToken, refresh, logout } from '../auth'

export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function authHeaders(): Record<string, string> {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const makeRequest = () =>
    fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options?.headers },
    })

  let res = await makeRequest()

  // On 401, try refreshing once and retry
  if (res.status === 401) {
    try {
      await refresh()
    } catch {
      logout()
      throw new Error('Session expired. Please log in again.')
    }
    res = await makeRequest()
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

// Media
export const mediaApi = {
  list: () => request<MediaFile[]>('/api/media'),
  upload: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const makeUpload = () =>
      fetch(`${BASE_URL}/api/media`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      })
    let res = await makeUpload()
    if (res.status === 401) {
      try {
        await refresh()
      } catch {
        logout()
        throw new Error('Session expired. Please log in again.')
      }
      res = await makeUpload()
    }
    if (!res.ok) throw new Error(await res.text())
    return res.json() as Promise<MediaFile>
  },
  delete: async (id: string) => {
    const makeDelete = () =>
      fetch(`${BASE_URL}/api/media/${id}`, { method: 'DELETE', headers: authHeaders() })
    let res = await makeDelete()
    if (res.status === 401) {
      try { await refresh() } catch { logout(); throw new Error('Session expired. Please log in again.') }
      res = await makeDelete()
    }
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
  },
}

// Playlists
export const playlistApi = {
  list: () => request<Playlist[]>('/api/playlists'),
  get: (id: string, screenToken?: string) => {
    const headers = screenToken ? { Authorization: `Bearer ${screenToken}` } : undefined
    return request<Playlist>(`/api/playlists/${id}`, { headers })
  },
  create: (data: { title: string; description?: string }) =>
    request<Playlist>('/api/playlists', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Pick<Playlist, 'title' | 'description'>>) =>
    request<Playlist>(`/api/playlists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<void>(`/api/playlists/${id}`, { method: 'DELETE' }),
}

// Screens
export const screenApi = {
  list: () => request<Screen[]>('/api/screens'),
  get: (id: string) => request<Screen>(`/api/screens/${id}`),
  create: (data: { name: string; location?: string }) =>
    request<Screen>('/api/screens', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { name?: string; location?: string; current_playlist_id?: string | null }) =>
    request<Screen>(`/api/screens/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/api/screens/${id}`, { method: 'DELETE' }),
  heartbeat: (token: string) =>
    fetch(`${BASE_URL}/api/screens/heartbeat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json() as Promise<{ screen_id: string; current_playlist_id: string | null; playlist: { id: string; title: string } | null }>),
}

// Playlist items
export const itemApi = {
  add: (
    playlistId: string,
    data: {
      media_file_id: string
      display_duration?: number
      transition_type?: string
      transition_duration?: number
    }
  ) =>
    request<PlaylistItem>(`/api/playlists/${playlistId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (
    playlistId: string,
    itemId: string,
    data: Partial<Pick<PlaylistItem, 'display_duration' | 'transition_type' | 'transition_duration'>>
  ) =>
    request<PlaylistItem>(`/api/playlists/${playlistId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  remove: (playlistId: string, itemId: string) =>
    request<void>(`/api/playlists/${playlistId}/items/${itemId}`, {
      method: 'DELETE',
    }),
  reorder: (playlistId: string, itemIds: string[]) =>
    request<PlaylistItem[]>(`/api/playlists/${playlistId}/items/reorder`, {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds }),
    }),
}
