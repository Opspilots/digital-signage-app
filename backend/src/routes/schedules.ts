import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema';

const router = Router({ mergeParams: true });

// Days of week bitmask: 1=Mon, 2=Tue, 4=Wed, 8=Thu, 16=Fri, 32=Sat, 64=Sun
const DAY_BITS = [1, 2, 4, 8, 16, 32, 64];

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Returns true if minute `m` falls within the range [start, end).
 * Handles overnight ranges (start >= end) by wrapping across midnight.
 */
function minuteInRange(m: number, start: number, end: number): boolean {
  if (start < end) {
    return m >= start && m < end;
  }
  // Overnight: active if m >= start (evening side) OR m < end (morning side)
  return m >= start || m < end;
}

/** Returns true if the two schedules share at least one day AND their time ranges overlap. */
function schedulesOverlap(
  a: { days_of_week: number; start_time: string; end_time: string },
  b: { days_of_week: number; start_time: string; end_time: string }
): boolean {
  if ((a.days_of_week & b.days_of_week) === 0) return false;
  const aStart = timeToMinutes(a.start_time);
  const aEnd = timeToMinutes(a.end_time);
  const bStart = timeToMinutes(b.start_time);
  const bEnd = timeToMinutes(b.end_time);
  // Check overlap by testing if either range's start falls within the other range
  return minuteInRange(aStart, bStart, bEnd) || minuteInRange(bStart, aStart, aEnd);
}

function validateTimeFormat(t: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(t)) return false;
  const [h, m] = t.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// GET /api/screens/:screenId/schedules
router.get('/', (req: Request, res: Response) => {
  const { screenId } = req.params;

  const screen = db.prepare('SELECT id FROM screens WHERE id = ?').get(screenId);
  if (!screen) {
    res.status(404).json({ error: 'Screen not found' });
    return;
  }

  const rows = db.prepare(`
    SELECT s.*, p.title as playlist_title
    FROM schedules s
    JOIN playlists p ON p.id = s.playlist_id
    WHERE s.screen_id = ?
    ORDER BY s.priority DESC, s.created_at ASC
  `).all(screenId);

  res.json(rows);
});

// POST /api/screens/:screenId/schedules
router.post('/', (req: Request, res: Response) => {
  const { screenId } = req.params;

  const screen = db.prepare('SELECT id FROM screens WHERE id = ?').get(screenId);
  if (!screen) {
    res.status(404).json({ error: 'Screen not found' });
    return;
  }

  const { playlist_id, days_of_week, start_time, end_time, priority } = req.body as {
    playlist_id?: string;
    days_of_week?: number;
    start_time?: string;
    end_time?: string;
    priority?: number;
  };

  if (!playlist_id || typeof playlist_id !== 'string') {
    res.status(400).json({ error: 'playlist_id is required' });
    return;
  }
  if (days_of_week === undefined || typeof days_of_week !== 'number' || days_of_week < 1 || days_of_week > 127) {
    res.status(400).json({ error: 'days_of_week must be a bitmask integer 1-127 (1=Mon...64=Sun)' });
    return;
  }
  if (!start_time || !validateTimeFormat(start_time)) {
    res.status(400).json({ error: 'start_time must be HH:MM' });
    return;
  }
  if (!end_time || !validateTimeFormat(end_time)) {
    res.status(400).json({ error: 'end_time must be HH:MM' });
    return;
  }
  // Allow start_time >= end_time for overnight schedules (e.g. 23:00-02:00)

  const playlist = db.prepare('SELECT id FROM playlists WHERE id = ?').get(playlist_id);
  if (!playlist) {
    res.status(404).json({ error: 'Playlist not found' });
    return;
  }

  const resolvedPriority = typeof priority === 'number' ? priority : 0;

  // Detect conflicts
  const existing = db.prepare('SELECT * FROM schedules WHERE screen_id = ?').all(screenId) as Array<{
    days_of_week: number;
    start_time: string;
    end_time: string;
  }>;

  const newSlot = { days_of_week, start_time, end_time };
  const conflicts = existing.filter(e => schedulesOverlap(e, newSlot));

  const id = uuidv4();
  db.prepare(`
    INSERT INTO schedules (id, screen_id, playlist_id, days_of_week, start_time, end_time, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, screenId, playlist_id, days_of_week, start_time, end_time, resolvedPriority);

  const row = db.prepare(`
    SELECT s.*, p.title as playlist_title
    FROM schedules s
    JOIN playlists p ON p.id = s.playlist_id
    WHERE s.id = ?
  `).get(id);

  const response: Record<string, unknown> = { ...(row as object) };
  if (conflicts.length > 0) {
    response.warnings = [`This schedule overlaps with ${conflicts.length} existing schedule(s) for this screen.`];
  }

  res.status(201).json(response);
});

// DELETE /api/screens/:screenId/schedules/:scheduleId
router.delete('/:scheduleId', (req: Request, res: Response) => {
  const { screenId, scheduleId } = req.params;

  const row = db.prepare('SELECT id FROM schedules WHERE id = ? AND screen_id = ?').get(scheduleId, screenId);
  if (!row) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }

  db.prepare('DELETE FROM schedules WHERE id = ?').run(scheduleId);
  res.status(204).send();
});

export { timeToMinutes };
export default router;
