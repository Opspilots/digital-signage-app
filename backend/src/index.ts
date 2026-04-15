import express from 'express';
import cors from 'cors';
import path from 'path';
import mediaRouter from './routes/media';
import playlistsRouter from './routes/playlists';
import authRouter from './routes/auth';
import { requireAuth } from './middleware/auth';

// Initialize DB (runs migrations on import)
import './db/schema';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Serve uploaded media files as static assets
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Public routes (no auth required)
app.use('/api/auth', authRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Protected API routes
app.use('/api/media', requireAuth, mediaRouter);
app.use('/api/playlists', requireAuth, playlistsRouter);

app.listen(PORT, () => {
  console.log(`Digital Signage API running on http://localhost:${PORT}`);
});
