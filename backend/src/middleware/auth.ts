import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';
export const JWT_ACCESS_TTL = '15m';
export const JWT_REFRESH_TTL = '7d';
export const SCREEN_TOKEN = process.env.SCREEN_TOKEN ?? '';

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

  // Screen token accepted as a fallback for read-only player access
  if (SCREEN_TOKEN && token === SCREEN_TOKEN) {
    next();
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
