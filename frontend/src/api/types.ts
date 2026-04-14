export interface MediaFile {
  id: string
  filename: string
  original_name: string
  mime_type: string
  size: number
  url: string
  thumbnail_url?: string
  created_at: string
}

export type TransitionType = 'none' | 'fade' | 'slide'

export interface PlaylistItem {
  id: string
  playlist_id: string
  media_file_id: string
  position: number
  display_duration: number
  transition_type: TransitionType
  transition_duration: number
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
