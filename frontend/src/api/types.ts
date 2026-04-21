export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}

export interface UserMe {
  id: string
  username: string
  email: string | null
  role: string
  created_at: string
}

export interface MediaFile {
  id: string
  filename: string
  original_name: string
  mime_type: string
  size: number
  url: string
  thumbnail_url?: string | null
  duration_seconds?: number | null
  width?: number | null
  height?: number | null
  fps?: number | null
  created_at: string
}

export type TransitionType =
  | 'none'
  | 'fade'
  | 'slide'
  | 'zoom-in'
  | 'zoom-out'
  | 'slide-left'
  | 'slide-up'
  | 'slide-down'
  | 'blur-in'
  | 'flip'
  | 'rotate-in'
  | 'bounce-in'
  | 'wipe-right'

export interface PlaylistItem {
  id: string
  playlist_id: string
  media_file_id: string | null
  position: number
  display_duration: number
  transition_type: TransitionType
  transition_duration: number
  days_of_week: number          // 0 = always; otherwise bitmask (Mon=1...Sun=64)
  start_time: string | null     // HH:MM; null = no start constraint
  end_time: string | null       // HH:MM; null = no end constraint
  media_file?: MediaFile
}

export interface Playlist {
  id: string
  title: string
  description?: string
  created_at: string
  updated_at: string
  items?: PlaylistItem[]
}

export interface Screen {
  id: string
  name: string
  location?: string
  status: string
  current_playlist_id?: string | null
  last_seen_at?: string | null
  token: string
  online: boolean
  created_at: string
  updated_at: string
}

export interface Schedule {
  id: string
  screen_id: string
  playlist_id: string
  playlist_title: string
  days_of_week: number
  start_time: string
  end_time: string
  priority: number
  created_at: string
}

export interface User {
  id: string
  username: string
  role: string
  email?: string | null
  created_at: string
}
