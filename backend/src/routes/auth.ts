import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/schema';
import { JWT_SECRET, JWT_ACCESS_TTL, JWT_REFRESH_TTL, AuthPayload } from '../middleware/auth';

const router = Router();

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
}

// POST /api/auth/login
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const basePayload = { sub: user.id, username: user.username, role: user.role ?? 'editor' };
  const accessToken = jwt.sign({ ...basePayload, type: 'access' }, JWT_SECRET, { expiresIn: JWT_ACCESS_TTL });
  const refreshToken = jwt.sign({ ...basePayload, type: 'refresh' }, JWT_SECRET, { expiresIn: JWT_REFRESH_TTL });

  res.json({ access_token: accessToken, refresh_token: refreshToken, token_type: 'Bearer' });
});

// POST /api/auth/refresh
router.post('/refresh', (req: Request, res: Response) => {
  const { refresh_token } = req.body as { refresh_token?: string };

  if (!refresh_token) {
    res.status(400).json({ error: 'refresh_token is required' });
    return;
  }

  try {
    const payload = jwt.verify(refresh_token, JWT_SECRET) as AuthPayload;
    if (payload.type !== 'refresh') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    // Verify user still exists
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(payload.sub) as Pick<UserRow, 'id' | 'username'> | undefined;
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const userWithRole = db.prepare('SELECT role FROM users WHERE id = ?').get(user.id) as { role: string } | undefined;
    const accessToken = jwt.sign(
      { sub: user.id, username: user.username, role: userWithRole?.role ?? 'editor', type: 'access' },
      JWT_SECRET,
      { expiresIn: JWT_ACCESS_TTL }
    );

    res.json({ access_token: accessToken, token_type: 'Bearer' });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

export default router;
