import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema';

const router = Router();

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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

function formatMediaFile(row: Record<string, unknown>) {
  const { size_bytes, filename, ...rest } = row;
  return {
    ...rest,
    filename,
    size: size_bytes,
    url: `/uploads/${filename}`,
  };
}

// POST /api/media — upload a file
router.post('/', upload.single('file'), (req: Request, res: Response) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO media_files (id, filename, original_name, mime_type, size_bytes, duration_seconds, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, file.filename, file.originalname, file.mimetype, file.size, null, now);

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
  const row = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id) as { filename: string } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Media file not found' });
    return;
  }

  // Delete from disk
  const filePath = path.join(UPLOADS_DIR, row.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM media_files WHERE id = ?').run(id);
  res.status(204).send();
});

export default router;
