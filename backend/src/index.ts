import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import logger from './utils/logger';
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
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : (process.env.NODE_ENV === 'production' ? 'http://localhost' : '*');
const CORS_ORIGIN = corsOrigin;

app.use(cors({ origin: CORS_ORIGIN }));

// GitHub webhook — registered BEFORE express.json() so raw body is available for HMAC
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const DEPLOY_SCRIPT = path.join(__dirname, '../../scripts/deploy.sh');
app.post('/webhook/github', express.raw({ type: '*/*' }), (req, res) => {
  if (!WEBHOOK_SECRET) { res.status(503).json({ error: 'Webhook not configured' }); return; }
  const sig = req.headers['x-hub-signature-256'] as string | undefined;
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
  const expected = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    res.status(401).json({ error: 'Invalid signature' }); return;
  }
  const payload = JSON.parse(body.toString()) as { ref?: string };
  if (payload.ref !== 'refs/heads/master') { res.json({ skipped: true }); return; }
  logger.info('GitHub webhook: deploying...');
  res.json({ ok: true, message: 'Deploy started' });
  execFile('bash', [DEPLOY_SCRIPT], { timeout: 300_000 }, (err, stdout, stderr) => {
    if (err) logger.error({ err, stderr }, 'Deploy failed');
    else logger.info({ stdout }, 'Deploy completed');
  });
});

app.use(express.json());

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

// Serve uploaded files
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve frontend static files (SPA fallback)
const FRONTEND_DIST = process.env.FRONTEND_DIST
  ? path.resolve(process.env.FRONTEND_DIST)
  : path.join(__dirname, '../../frontend/dist');

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  logger.info(`Digital Signage running on http://localhost:${PORT}`);
});
