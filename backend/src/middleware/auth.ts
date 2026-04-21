import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/schema';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

if (process.env.JWT_SECRET === 'change-me-in-production' || !process.env.JWT_SECRET) {
  console.warn('[SECURITY WARNING] JWT_SECRET is not set or uses default value. Set a strong secret in .env before production use.');
}

export const JWT_ACCESS_TTL = '2h';
export const JWT_REFRESH_TTL = '7d';

export interface AuthPayload {
  sub: string;
  username: string;
  role: string;
  type: 'access' | 'refresh';
}

// Screen tokens (device tokens) are allowed to read their assigned playlist.
// Uses req.originalUrl (full path) because req.path is stripped by Express mount prefix.
function isScreenTokenAllowed(req: Request): boolean {
  const url = req.originalUrl.split('?')[0];
  // Allow read-only access to a single playlist (for PlaylistPlayer on screen devices)
  return req.method === 'GET' && /^\/api\/playlists\/[^/]+$/.test(url);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);

  // Screen tokens are only valid for reading playlists (PlaylistPlayer on screen devices)
  const screenRow = db.prepare('SELECT id FROM screens WHERE token = ?').get(token);
  if (screenRow) {
    if (isScreenTokenAllowed(req)) {
      next();
      return;
    }
    // Screen token used on a protected admin route — reject
    res.status(403).json({ error: 'Screen tokens are not allowed on this endpoint' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    if (payload.type !== 'access') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    (req as Request & { user?: AuthPayload }).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
