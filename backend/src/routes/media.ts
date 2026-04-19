import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import db from '../db/schema';
import logger from '../utils/logger';

// Configure fluent-ffmpeg with static binaries
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const router = Router();

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(THUMBNAILS_DIR)) {
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/flac',
];

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
});

function isVideo(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

export function parseFps(fpsStr: string): number | null {
  const [num, den] = fpsStr.split('/').map(Number);
  if (isNaN(num)) return null;
  return den ? num / den : num;
}

interface VideoMetadata {
  duration: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
}

function getVideoMetadata(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata) {
        resolve({ duration: null, width: null, height: null, fps: null });
        return;
      }
      const duration = metadata.format?.duration ?? null;
      const videoStream = metadata.streams?.find((s) => s.codec_type === 'video');
      const width = videoStream?.width ?? null;
      const height = videoStream?.height ?? null;
      const fpsStr = videoStream?.r_frame_rate;
      const fps = fpsStr ? parseFps(fpsStr) : null;
      resolve({ duration, width, height, fps });
    });
  });
}

function getAudioDuration(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata?.format?.duration) {
        resolve(null);
        return;
      }
      resolve(metadata.format.duration);
    });
  });
}

function generateThumbnail(filePath: string, thumbnailFilename: string): Promise<string | null> {
  return new Promise((resolve) => {
    const outputPath = path.join(THUMBNAILS_DIR, thumbnailFilename);
    ffmpeg(filePath)
      .on('end', () => resolve(thumbnailFilename))
      .on('error', () => resolve(null))
      .screenshots({
        timestamps: ['00:00:01'],
        filename: thumbnailFilename,
        folder: THUMBNAILS_DIR,
        size: '320x180',
      });
  });
}

function formatMediaFile(row: Record<string, unknown>) {
  const { size_bytes, filename, thumbnail_path, width, height, fps, ...rest } = row;
  return {
    ...rest,
    filename,
    size: size_bytes,
    url: `/uploads/${filename}`,
    thumbnail_url: thumbnail_path ? `/uploads/thumbnails/${thumbnail_path}` : undefined,
    width: width ?? null,
    height: height ?? null,
    fps: fps ?? null,
  };
}

// Magic byte signatures for allowed MIME types
// For MP4: bytes[4..7] must be 'ftyp' (standard ISO base media file format box)
const MAGIC_BYTES: Record<string, { offset: number; signatures: Buffer[] }> = {
  'video/mp4': {
    offset: 4,
    signatures: [Buffer.from('ftyp', 'ascii')],
  },
  'image/jpeg': { offset: 0, signatures: [Buffer.from([0xFF, 0xD8, 0xFF])] },
  'image/png':  { offset: 0, signatures: [Buffer.from([0x89, 0x50, 0x4E, 0x47])] },
  'image/gif':  { offset: 0, signatures: [Buffer.from([0x47, 0x49, 0x46, 0x38])] },
  'video/webm': { offset: 0, signatures: [Buffer.from([0x1A, 0x45, 0xDF, 0xA3])] },
};

async function validateMagicBytes(filePath: string, mimeType: string): Promise<boolean> {
  const entry = MAGIC_BYTES[mimeType];
  if (!entry) return true; // tipo no mapeado, acepta
  try {
    const fh = await fs.promises.open(filePath, 'r');
    try {
      const buf = Buffer.alloc(12);
      await fh.read(buf, 0, 12, 0);
      return entry.signatures.some((sig) =>
        buf.subarray(entry.offset, entry.offset + sig.length).equals(sig)
      );
    } finally {
      await fh.close();
    }
  } catch {
    return false;
  }
}

// POST /api/media — upload a file
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upload error' });
      return;
    }
    next();
  });
}, async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const filePath = path.join(UPLOADS_DIR, file.filename);

  // Validate magic bytes match the declared MIME type
  if (!await validateMagicBytes(filePath, file.mimetype)) {
    fs.unlinkSync(filePath);
    res.status(400).json({ error: `El contenido del archivo no coincide con el tipo declarado (${file.mimetype})` });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  let durationSeconds: number | null = null;
  let thumbnailPath: string | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let fps: number | null = null;

  if (isVideo(file.mimetype)) {
    const thumbnailFilename = `${id}.jpg`;
    const [meta, thumb] = await Promise.all([
      getVideoMetadata(filePath),
      generateThumbnail(filePath, thumbnailFilename),
    ]);
    durationSeconds = meta.duration;
    width = meta.width;
    height = meta.height;
    fps = meta.fps;
    thumbnailPath = thumb;
    logger.info({ id, original_name: file.originalname, duration: durationSeconds, width, height, fps }, 'Video metadata extracted');
  } else if (file.mimetype.startsWith('audio/')) {
    durationSeconds = await getAudioDuration(filePath);
  }

  db.prepare(`
    INSERT INTO media_files (id, filename, original_name, mime_type, size_bytes, duration_seconds, thumbnail_path, width, height, fps, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, file.filename, file.originalname, file.mimetype, file.size, durationSeconds, thumbnailPath, width, height, fps, now);

  const row = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json(formatMediaFile(row));
});

// GET /api/media — list media files with pagination and optional filters (excluding soft-deleted)
// Query params: limit, offset, search/q (name), type (image|video|audio), minSize, maxSize
router.get('/', (req: Request, res: Response) => {
  const limit   = Math.max(1, parseInt(String(req.query.limit  ?? 50), 10) || 50);
  const offset  = Math.max(0, parseInt(String(req.query.offset ?? 0),  10) || 0);
  const search  = String(req.query.search ?? req.query.q ?? '').trim();
  const type    = String(req.query.type ?? '').trim().toLowerCase();
  const minSize = req.query.minSize !== undefined ? parseInt(String(req.query.minSize), 10) : null;
  const maxSize = req.query.maxSize !== undefined ? parseInt(String(req.query.maxSize), 10) : null;

  const conditions: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];

  if (search) {
    conditions.push("original_name LIKE ?");
    params.push(`%${search}%`);
  }

  if (type === 'image' || type === 'video' || type === 'audio') {
    conditions.push("mime_type LIKE ?");
    params.push(`${type}/%`);
  }

  if (minSize !== null && !isNaN(minSize)) {
    conditions.push("size_bytes >= ?");
    params.push(minSize);
  }

  if (maxSize !== null && !isNaN(maxSize)) {
    conditions.push("size_bytes <= ?");
    params.push(maxSize);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM media_files ${where}`).get(...params) as { total: number };
  const rows = db.prepare(`SELECT * FROM media_files ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as Array<Record<string, unknown>>;

  res.json({ items: rows.map(formatMediaFile), total, limit, offset });
});

// DELETE /api/media/:id — soft-delete media file (keeps physical file on disk)
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM media_files WHERE id = ? AND deleted_at IS NULL').get(id) as { filename: string; thumbnail_path: string | null } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Media file not found' });
    return;
  }

  db.prepare("UPDATE media_files SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  res.status(204).send();
});

export default router;
