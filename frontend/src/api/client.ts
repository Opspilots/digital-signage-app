import type { MediaFile, Playlist, PlaylistItem } from './types'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

// Media
export const mediaApi = {
  list: () => request<MediaFile[]>('/api/media'),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return fetch(`${BASE_URL}/api/media`, {
      method: 'POST',
      body: form,
    }).then(async (res) => {
      if (!res.ok) throw new Error(await res.text())
      return res.json() as Promise<MediaFile>
    })
  },
  delete: (id: string) =>
    fetch(`${BASE_URL}/api/media/${id}`, { method: 'DELETE' }).then((res) => {
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
    }),
}

// Playlists
export const playlistApi = {
  list: () => request<Playlist[]>('/api/playlists'),
  get: (id: string) => request<Playlist>(`/api/playlists/${id}`),
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
