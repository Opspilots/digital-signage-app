import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema';
import { timeToMinutes } from './schedules';

const router = Router();

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

function isOnline(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

function formatScreen(row: Record<string, unknown>) {
  return {
    ...row,
    online: isOnline(row.last_seen_at as string | null),
  };
}

// GET /api/screens — list all screens
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM screens ORDER BY created_at DESC').all() as Array<Record<string, unknown>>;
  res.json(rows.map(formatScreen));
});

// POST /api/screens — register new screen
router.post('/', (req: Request, res: Response) => {
  const { name, location } = req.body as { name?: string; location?: string };

  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const id = uuidv4();
  const token = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO screens (id, name, location, status, token, created_at, updated_at)
    VALUES (?, ?, ?, 'offline', ?, ?, ?)
  `).run(id, name.trim(), location ?? null, token, now, now);

  const row = db.prepare('SELECT * FROM screens WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json(formatScreen(row));
});

// GET /api/screens/:id — get single screen
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM screens WHERE id = ?').get(id) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Screen not found' });
    return;
  }

  res.json(formatScreen(row));
});

// PATCH /api/screens/:id — update screen (name, location, current_playlist_id)
router.patch('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM screens WHERE id = ?').get(id) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Screen not found' });
    return;
  }

  const { name, location, current_playlist_id } = req.body as {
    name?: string;
    location?: string;
    current_playlist_id?: string | null;
  };

  const updates: string[] = ['updated_at = ?'];
  const params: unknown[] = [new Date().toISOString()];

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({ error: 'name must be a non-empty string' });
      return;
    }
    updates.push('name = ?');
    params.push(name.trim());
  }

  if (location !== undefined) {
    updates.push('location = ?');
    params.push(location ?? null);
  }

  if (current_playlist_id !== undefined) {
    if (current_playlist_id !== null) {
      const playlist = db.prepare('SELECT id FROM playlists WHERE id = ?').get(current_playlist_id);
      if (!playlist) {
        res.status(404).json({ error: 'Playlist not found' });
        return;
      }
    }
    updates.push('current_playlist_id = ?');
    params.push(current_playlist_id ?? null);
  }

  params.push(id);
  db.prepare(`UPDATE screens SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM screens WHERE id = ?').get(id) as Record<string, unknown>;
  res.json(formatScreen(updated));
});

// DELETE /api/screens/:id — delete screen
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM screens WHERE id = ?').get(id);

  if (!row) {
    res.status(404).json({ error: 'Screen not found' });
    return;
  }

  db.prepare('DELETE FROM screens WHERE id = ?').run(id);
  res.status(204).send();
});

export default router;

// Public router for screen-token-authenticated endpoints (no user JWT required)
import { Router as PublicRouter } from 'express';
export const screensPublicRouter = PublicRouter();

// POST /api/screens/heartbeat — screen device heartbeat
screensPublicRouter.post('/heartbeat', (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);

  const screen = db.prepare('SELECT * FROM screens WHERE token = ?').get(token) as Record<string, unknown> | undefined;
  if (!screen) {
    res.status(401).json({ error: 'Invalid screen token' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE screens SET last_seen_at = ?, status = 'online', updated_at = ? WHERE id = ?
  `).run(now, now, screen.id);

  // Resolve active playlist via schedule
  const nowDate = new Date();
  // JS getDay(): 0=Sun, 1=Mon...6=Sat → bitmask: Mon=1,Tue=2,...,Sun=64
  const jsDow = nowDate.getDay();
  const dowBit = jsDow === 0 ? 64 : (1 << (jsDow - 1));
  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  type ScheduleRow = { id: string; playlist_id: string; days_of_week: number; start_time: string; end_time: string; priority: number };
  const schedules = db.prepare(`
    SELECT id, playlist_id, days_of_week, start_time, end_time, priority
    FROM schedules
    WHERE screen_id = ?
    ORDER BY priority DESC
  `).all(screen.id as string) as ScheduleRow[];

  let resolvedPlaylistId: string | null = null;
  let scheduleActive = false;

  for (const sched of schedules) {
    if ((sched.days_of_week & dowBit) === 0) continue;
    const start = timeToMinutes(sched.start_time);
    const end = timeToMinutes(sched.end_time);
    if (currentMinutes >= start && currentMinutes < end) {
      resolvedPlaylistId = sched.playlist_id;
      scheduleActive = true;
      break;
    }
  }

  if (!scheduleActive) {
    resolvedPlaylistId = (screen.current_playlist_id as string | null) ?? null;
  }

  let playlist = null;
  if (resolvedPlaylistId) {
    playlist = db.prepare('SELECT id, title FROM playlists WHERE id = ?').get(resolvedPlaylistId);
  }

  res.json({
    screen_id: screen.id,
    current_playlist_id: resolvedPlaylistId,
    playlist,
    schedule_active: scheduleActive,
  });
});
