import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/schema';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
export const JWT_ACCESS_TTL = '15m';
export const JWT_REFRESH_TTL = '7d';

export interface AuthPayload {
  sub: string;
  username: string;
  role: string;
  type: 'access' | 'refresh';
}

// Routes where screen tokens (device tokens) are permitted
const SCREEN_TOKEN_PUBLIC_PATHS = [
  '/api/screens/pair',
  '/api/screens/heartbeat',
  '/api/screens/content',
];

function isScreenTokenPublicPath(path: string): boolean {
  return SCREEN_TOKEN_PUBLIC_PATHS.some((p) => path.startsWith(p));
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);

  // Screen tokens are only valid on public screen endpoints
  const screenRow = db.prepare('SELECT id FROM screens WHERE token = ?').get(token);
  if (screenRow) {
    if (isScreenTokenPublicPath(req.path)) {
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
