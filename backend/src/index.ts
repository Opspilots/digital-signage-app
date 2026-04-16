import express from 'express';
import cors from 'cors';
import path from 'path';
import mediaRouter from './routes/media';
import playlistsRouter from './routes/playlists';
import authRouter from './routes/auth';
import screensRouter, { screensPublicRouter } from './routes/screens';
import schedulesRouter from './routes/schedules';
import usersRouter from './routes/users';
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
app.use('/api/screens', screensPublicRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Protected API routes
app.use('/api/media', requireAuth, mediaRouter);
app.use('/api/playlists', requireAuth, playlistsRouter);
app.use('/api/screens', requireAuth, screensRouter);
app.use('/api/screens/:screenId/schedules', requireAuth, schedulesRouter);
app.use('/api/users', requireAuth, usersRouter);

// Serve frontend static files (SPA fallback)
const FRONTEND_DIST = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : path.join(__dirname, '../../frontend/dist');

import fs from 'fs';
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Digital Signage running on http://localhost:${PORT}`);
});
