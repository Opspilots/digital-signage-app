import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import db from '../db/schema';
import { timeToMinutes } from './schedules';

// Rate limit: max 5 pairing requests per minute per IP
const pairNewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de emparejamiento. Inténtalo de nuevo en un minuto.' },
});

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

// GET /api/screens — list all claimed screens
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare(
    'SELECT * FROM screens WHERE pairing_code IS NULL ORDER BY created_at DESC'
  ).all() as Array<Record<string, unknown>>;
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

// GET /api/screens/ble-info — BLE advertisement info for screen devices
router.get('/ble-info', (_req: Request, res: Response) => {
  res.json({
    serviceUUID: '12345678-1234-5678-1234-56789abcdef0',
    deviceName: 'SignageScreen',
    version: '1.0',
  });
});

// POST /api/screens/pair/claim (authenticated) — claim a pending screen with a 6-digit code
router.post('/pair/claim', (req: Request, res: Response) => {
  const { code, name, location } = req.body as { code?: string; name?: string; location?: string };
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'code is required' });
    return;
  }
  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  const normalized = code.replace(/\s+/g, '').trim().toUpperCase();
  const now = new Date();

  const screen = db.prepare(
    'SELECT * FROM screens WHERE pairing_code = ?'
  ).get(normalized) as Record<string, unknown> | undefined;

  if (!screen) {
    res.status(404).json({ error: 'Código no válido o caducado' });
    return;
  }

  const expiresAt = screen.pairing_expires_at as string | null;
  if (expiresAt && new Date(expiresAt) < now) {
    db.prepare('DELETE FROM screens WHERE id = ?').run(screen.id);
    res.status(410).json({ error: 'Código caducado. Solicita uno nuevo en la pantalla.' });
    return;
  }

  db.prepare(`
    UPDATE screens
    SET name = ?, location = ?, pairing_code = NULL, pairing_expires_at = NULL, updated_at = ?
    WHERE id = ?
  `).run(name.trim(), location ?? null, now.toISOString(), screen.id);

  const updated = db.prepare('SELECT * FROM screens WHERE id = ?').get(screen.id) as Record<string, unknown>;
  res.json(formatScreen(updated));
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

// POST /api/screens/:id/unpair — convert a claimed screen back into a pending pairing
router.post('/:id/unpair', (req: Request, res: Response) => {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM screens WHERE id = ?').get(id);
  if (!row) {
    res.status(404).json({ error: 'Screen not found' });
    return;
  }
  // Easier to just delete the claimed screen — the TV (with the old token) will lose heartbeat
  // and the operator must re-open /pair to get a fresh code.
  db.prepare('DELETE FROM screens WHERE id = ?').run(id);
  res.status(204).send();
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

const PAIRING_TTL_MS = 15 * 60 * 1000; // 15 minutes

function generatePairingCode(): string {
  // 6 chars, avoid ambiguous (O/0, I/1)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

// POST /api/screens/pair/new (public) — request a pairing code.
// Creates a pending screen with placeholder name. Returns code + token.
screensPublicRouter.post('/pair/new', pairNewLimiter, (_req: Request, res: Response) => {
  // Garbage collect expired pending screens
  db.prepare('DELETE FROM screens WHERE pairing_code IS NOT NULL AND pairing_expires_at < ?')
    .run(new Date().toISOString());

  // Generate a unique code
  let code = generatePairingCode();
  for (let tries = 0; tries < 10; tries++) {
    const exists = db.prepare('SELECT 1 FROM screens WHERE pairing_code = ?').get(code);
    if (!exists) break;
    code = generatePairingCode();
  }

  const id = uuidv4();
  const token = uuidv4();
  const now = new Date();
  const expires = new Date(now.getTime() + PAIRING_TTL_MS);

  db.prepare(`
    INSERT INTO screens (id, name, location, status, token, pairing_code, pairing_expires_at, created_at, updated_at)
    VALUES (?, ?, NULL, 'offline', ?, ?, ?, ?, ?)
  `).run(id, 'Pantalla sin nombre', token, code, expires.toISOString(), now.toISOString(), now.toISOString());

  res.status(201).json({
    screen_id: id,
    token,
    code,
    expires_at: expires.toISOString(),
  });
});

// GET /api/screens/pair/status (public, uses screen token via Bearer) — pending/claimed status
screensPublicRouter.get('/pair/status', (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);
  const screen = db.prepare(
    'SELECT id, name, pairing_code, pairing_expires_at FROM screens WHERE token = ?'
  ).get(token) as { id: string; name: string; pairing_code: string | null; pairing_expires_at: string | null } | undefined;

  if (!screen) {
    res.status(404).json({ error: 'Invalid token' });
    return;
  }

  const claimed = screen.pairing_code === null;
  res.json({
    claimed,
    screen_id: screen.id,
    name: screen.name,
    code: screen.pairing_code,
    expires_at: screen.pairing_expires_at,
  });
});

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

  // Resolve active playlist via schedule — all comparisons done in UTC
  const nowDate = new Date();
  // getUTCDay(): 0=Sun, 1=Mon...6=Sat → bitmask: Mon=1,Tue=2,...,Sun=64
  const jsDow = nowDate.getUTCDay();
  const dowBit = jsDow === 0 ? 64 : (1 << (jsDow - 1));
  const currentMinutes = nowDate.getUTCHours() * 60 + nowDate.getUTCMinutes();

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
