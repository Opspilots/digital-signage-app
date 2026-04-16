import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/schema';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
export const JWT_ACCESS_TTL = '15m';
export const JWT_REFRESH_TTL = '7d';

export interface AuthPayload {
  sub: string;
  username: string;
  type: 'access' | 'refresh';
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const token = header.slice(7);

  // Accept any registered screen token for GET (read-only player access)
  if (req.method === 'GET') {
    const screenRow = db.prepare('SELECT id FROM screens WHERE token = ?').get(token);
    if (screenRow) {
      next();
      return;
    }
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
