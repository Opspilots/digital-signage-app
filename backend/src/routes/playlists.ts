import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema';

const router = Router();

function formatItem(row: Record<string, unknown>) {
  const { filename, original_name, mime_type, size_bytes, duration_seconds, media_file_id, ...item } = row;
  return {
    ...item,
    media_file_id,
    media_file: {
      id: media_file_id,
      original_name,
      mime_type,
      url: `/uploads/${filename}`,
    },
  };
}

function getItems(playlistId: string) {
  const rows = db.prepare(`
    SELECT pi.*, mf.filename, mf.original_name, mf.mime_type, mf.size_bytes, mf.duration_seconds
    FROM playlist_items pi
    JOIN media_files mf ON mf.id = pi.media_file_id
    WHERE pi.playlist_id = ?
    ORDER BY pi.position ASC
  `).all(playlistId) as Array<Record<string, unknown>>;
  return rows.map(formatItem);
}

// GET /api/playlists — list all playlists
router.get('/', (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM playlists ORDER BY created_at DESC').all();
  res.json(rows);
});

// POST /api/playlists — create playlist
router.post('/', (req: Request, res: Response) => {
  const { title, description } = req.body as { title?: string; description?: string };

  if (!title || typeof title !== 'string' || title.trim() === '') {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO playlists (id, title, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, title.trim(), description ?? null, now, now);

  const row = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
  res.status(201).json(row);
});

// GET /api/playlists/:id — get playlist with items
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);

  if (!playlist) {
    res.status(404).json({ error: 'Playlist not found' });
    return;
  }

  res.json({ ...playlist as object, items: getItems(id) });
});

// PATCH /api/playlists/:id — update playlist metadata
// PUT /api/playlists/:id — same handler (frontend uses PUT)
function updatePlaylist(req: Request, res: Response) {
  const { id } = req.params;
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);

  if (!playlist) {
    res.status(404).json({ error: 'Playlist not found' });
    return;
  }

  const { title, description } = req.body as { title?: string; description?: string };
  const now = new Date().toISOString();

  const updates: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({ error: 'title must be a non-empty string' });
      return;
    }
    updates.push('title = ?');
    params.push(title.trim());
  }

  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description);
  }

  params.push(id);
  db.prepare(`UPDATE playlists SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
  res.json(updated);
}

router.patch('/:id', updatePlaylist);
router.put('/:id', updatePlaylist);

// POST /api/playlists/:id/duplicate — clone playlist and all its items
router.post('/:id/duplicate', (req: Request, res: Response) => {
  const { id } = req.params;
  const source = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id) as
    | { title: string; description: string | null }
    | undefined;

  if (!source) {
    res.status(404).json({ error: 'Playlist not found' });
    return;
  }

  const newId = uuidv4();
  const now = new Date().toISOString();
  const newTitle = `${source.title} (copia)`;

  const duplicate = db.transaction(() => {
    db.prepare(`
      INSERT INTO playlists (id, title, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(newId, newTitle, source.description, now, now);

    const items = db.prepare(
      'SELECT * FROM playlist_items WHERE playlist_id = ? ORDER BY position ASC'
    ).all(id) as Array<{
      media_file_id: string;
      position: number;
      display_duration: number;
      transition_type: string;
      transition_duration: number;
      days_of_week: number | null;
      start_time: string | null;
      end_time: string | null;
    }>;

    const insert = db.prepare(`
      INSERT INTO playlist_items (id, playlist_id, media_file_id, position, display_duration, transition_type, transition_duration, days_of_week, start_time, end_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const it of items) {
      insert.run(
        uuidv4(), newId, it.media_file_id, it.position,
        it.display_duration, it.transition_type, it.transition_duration,
        it.days_of_week ?? 0, it.start_time, it.end_time,
      );
    }
  });

  duplicate();
  const row = db.prepare('SELECT * FROM playlists WHERE id = ?').get(newId);
  res.status(201).json({ ...row as object, items: getItems(newId) });
});

// DELETE /api/playlists/:id — delete playlist and its items
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);

  if (!playlist) {
    res.status(404).json({ error: 'Playlist not found' });
    return;
  }

  // Cascade delete is handled by FK constraint
  db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
  res.status(204).send();
});

// POST /api/playlists/:id/items — add a single item
router.post('/:id/items', (req: Request, res: Response) => {
  const { id } = req.params;
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);

  if (!playlist) {
    res.status(404).json({ error: 'Playlist not found' });
    return;
  }

  const { media_file_id, display_duration, transition_type, transition_duration } = req.body as {
    media_file_id?: string;
    display_duration?: number;
    transition_type?: string;
    transition_duration?: number;
  };

  if (!media_file_id || typeof media_file_id !== 'string') {
    res.status(400).json({ error: 'media_file_id is required' });
    return;
  }

  const media = db.prepare('SELECT * FROM media_files WHERE id = ?').get(media_file_id) as { mime_type: string; duration_seconds: number | null } | undefined;
  if (!media) {
    res.status(404).json({ error: 'Media file not found' });
    return;
  }

  const maxPositionRow = db.prepare(
    'SELECT MAX(position) as max_pos FROM playlist_items WHERE playlist_id = ?'
  ).get(id) as { max_pos: number | null };
  const nextPosition = (maxPositionRow.max_pos ?? -1) + 1;

  // Default display_duration: use actual video duration if available, else 5s
  const defaultDuration = media.mime_type.startsWith('video/') && media.duration_seconds
    ? Math.round(media.duration_seconds)
    : 5;

  const itemId = uuidv4();
  db.prepare(`
    INSERT INTO playlist_items (id, playlist_id, media_file_id, position, display_duration, transition_type, transition_duration)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    itemId, id, media_file_id, nextPosition,
    display_duration ?? defaultDuration,
    transition_type ?? 'none',
    transition_duration ?? 500,
  );

  db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);

  const row = db.prepare(`
    SELECT pi.*, mf.filename, mf.original_name, mf.mime_type, mf.size_bytes, mf.duration_seconds
    FROM playlist_items pi
    JOIN media_files mf ON mf.id = pi.media_file_id
    WHERE pi.id = ?
  `).get(itemId) as Record<string, unknown>;

  res.status(201).json(formatItem(row));
});

// POST /api/playlists/:id/items/reorder — reorder items by ID list
router.post('/:id/items/reorder', (req: Request, res: Response) => {
  const { id } = req.params;
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);

  if (!playlist) {
    res.status(404).json({ error: 'Playlist not found' });
    return;
  }

  const { item_ids } = req.body as { item_ids?: string[] };

  if (!Array.isArray(item_ids)) {
    res.status(400).json({ error: 'item_ids must be an array' });
    return;
  }

  const reorder = db.transaction(() => {
    const update = db.prepare(
      'UPDATE playlist_items SET position = ? WHERE id = ? AND playlist_id = ?'
    );
    for (let i = 0; i < item_ids.length; i++) {
      update.run(i, item_ids[i], id);
    }
    db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  });

  reorder();
  res.json(getItems(id));
});

// PUT /api/playlists/:id/items — replace all items
router.put('/:id/items', (req: Request, res: Response) => {
  const { id } = req.params;
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);

  if (!playlist) {
    res.status(404).json({ error: 'Playlist not found' });
    return;
  }

  const items = req.body as Array<{
    media_file_id: string;
    display_duration?: number;
    transition_type?: string;
    transition_duration?: number;
  }>;

  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'Body must be an array of items' });
    return;
  }

  // Validate all media_file_ids exist before starting the transaction
  if (items.length > 0) {
    const missingIds: string[] = [];
    for (const item of items) {
      const exists = db.prepare('SELECT id FROM media_files WHERE id = ?').get(item.media_file_id);
      if (!exists) missingIds.push(item.media_file_id);
    }
    if (missingIds.length > 0) {
      res.status(400).json({
        error: `The following media_file_ids were not found: ${missingIds.join(', ')}`,
      });
      return;
    }
  }

  const replaceItems = db.transaction(() => {
    db.prepare('DELETE FROM playlist_items WHERE playlist_id = ?').run(id);

    const insert = db.prepare(`
      INSERT INTO playlist_items (id, playlist_id, media_file_id, position, display_duration, transition_type, transition_duration)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const getMedia = db.prepare('SELECT mime_type, duration_seconds FROM media_files WHERE id = ?');

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const media = getMedia.get(item.media_file_id) as { mime_type: string; duration_seconds: number | null } | undefined;
      if (!media) {
        throw new Error(`Media file not found: ${item.media_file_id}`);
      }
      const defaultDuration = media.mime_type.startsWith('video/') && media.duration_seconds
        ? Math.round(media.duration_seconds)
        : 5;
      insert.run(
        uuidv4(), id, item.media_file_id, i,
        item.display_duration ?? defaultDuration,
        item.transition_type ?? 'none',
        item.transition_duration ?? 500,
      );
    }

    db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  });

  try {
    replaceItems();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Transaction failed';
    res.status(400).json({ error: msg });
    return;
  }
  res.json(getItems(id));
});

// PATCH /api/playlists/:id/items/:itemId — update single item settings
// PUT /api/playlists/:id/items/:itemId — same handler (frontend uses PUT)
function updateItem(req: Request, res: Response) {
  const { id, itemId } = req.params;

  const item = db.prepare(
    'SELECT * FROM playlist_items WHERE id = ? AND playlist_id = ?'
  ).get(itemId, id);

  if (!item) {
    res.status(404).json({ error: 'Playlist item not found' });
    return;
  }

  const { display_duration, transition_type, transition_duration, days_of_week, start_time, end_time } = req.body as {
    display_duration?: number;
    transition_type?: string;
    transition_duration?: number;
    days_of_week?: number;
    start_time?: string | null;
    end_time?: string | null;
  };

  const updates: string[] = [];
  const params: unknown[] = [];

  if (display_duration !== undefined) {
    updates.push('display_duration = ?');
    params.push(display_duration);
  }
  if (transition_type !== undefined) {
    updates.push('transition_type = ?');
    params.push(transition_type);
  }
  if (transition_duration !== undefined) {
    updates.push('transition_duration = ?');
    params.push(transition_duration);
  }
  if (days_of_week !== undefined) {
    updates.push('days_of_week = ?');
    params.push(days_of_week);
  }
  if (start_time !== undefined) {
    updates.push('start_time = ?');
    params.push(start_time);
  }
  if (end_time !== undefined) {
    updates.push('end_time = ?');
    params.push(end_time);
  }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No updatable fields provided' });
    return;
  }

  params.push(itemId, id);
  db.prepare(`UPDATE playlist_items SET ${updates.join(', ')} WHERE id = ? AND playlist_id = ?`).run(...params);
  db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);

  const row = db.prepare(`
    SELECT pi.*, mf.filename, mf.original_name, mf.mime_type, mf.size_bytes, mf.duration_seconds
    FROM playlist_items pi
    JOIN media_files mf ON mf.id = pi.media_file_id
    WHERE pi.id = ?
  `).get(itemId) as Record<string, unknown>;

  res.json(formatItem(row));
}

router.patch('/:id/items/:itemId', updateItem);
router.put('/:id/items/:itemId', updateItem);

// DELETE /api/playlists/:id/items/:itemId — remove single item
router.delete('/:id/items/:itemId', (req: Request, res: Response) => {
  const { id, itemId } = req.params;

  const item = db.prepare(
    'SELECT * FROM playlist_items WHERE id = ? AND playlist_id = ?'
  ).get(itemId, id);

  if (!item) {
    res.status(404).json({ error: 'Playlist item not found' });
    return;
  }

  db.prepare('DELETE FROM playlist_items WHERE id = ? AND playlist_id = ?').run(itemId, id);
  db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  res.status(204).send();
});

export default router;
