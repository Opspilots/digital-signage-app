import { z } from 'zod';

export const MediaFileSchema = z.object({
  id: z.string(),
  filename: z.string(),
  original_name: z.string(),
  mime_type: z.string(),
  size: z.number(),
  url: z.string(),
  duration_seconds: z.number().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  fps: z.number().nullable().optional(),
  created_at: z.string(),
});

export const PlaylistSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ScreenSchema = z.object({
  id: z.string(),
  name: z.string(),
  token: z.string(),
  location: z.string().optional(),
  status: z.string(),
  paired: z.boolean().optional(),
  online: z.boolean().optional(),
  last_seen: z.string().nullable().optional(),
  last_seen_at: z.string().nullable().optional(),
  current_playlist_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
