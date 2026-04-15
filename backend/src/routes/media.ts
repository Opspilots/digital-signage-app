import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import db from '../db/schema';

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

function getVideoDuration(filePath: string): Promise<number | null> {
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
  const { size_bytes, filename, thumbnail_path, ...rest } = row;
  return {
    ...rest,
    filename,
    size: size_bytes,
    url: `/uploads/${filename}`,
    thumbnail_url: thumbnail_path ? `/uploads/thumbnails/${thumbnail_path}` : undefined,
  };
}

// POST /api/media — upload a file
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const filePath = path.join(UPLOADS_DIR, file.filename);

  let durationSeconds: number | null = null;
  let thumbnailPath: string | null = null;

  if (isVideo(file.mimetype)) {
    const thumbnailFilename = `${id}.jpg`;
    [durationSeconds, thumbnailPath] = await Promise.all([
      getVideoDuration(filePath),
      generateThumbnail(filePath, thumbnailFilename),
    ]);
  }

  db.prepare(`
    INSERT INTO media_files (id, filename, original_name, mime_type, size_bytes, duration_seconds, thumbnail_path, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, file.filename, file.originalname, file.mimetype, file.size, durationSeconds, thumbnailPath, now);

  const row = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json(formatMediaFile(row));
});

// GET /api/media — list all media files
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM media_files ORDER BY created_at DESC').all() as Array<Record<string, unknown>>;
  res.json(rows.map(formatMediaFile));
});

// DELETE /api/media/:id — delete media file
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id) as { filename: string; thumbnail_path: string | null } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Media file not found' });
    return;
  }

  // Delete files from disk
  const filePath = path.join(UPLOADS_DIR, row.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  if (row.thumbnail_path) {
    const thumbPath = path.join(THUMBNAILS_DIR, row.thumbnail_path);
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }
  }

  db.prepare('DELETE FROM media_files WHERE id = ?').run(id);
  res.status(204).send();
});

export default router;
