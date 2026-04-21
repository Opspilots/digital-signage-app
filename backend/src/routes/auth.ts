import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/schema';
import { JWT_SECRET, JWT_ACCESS_TTL, JWT_REFRESH_TTL, AuthPayload, requireAuth } from '../middleware/auth';

// In-memory revoked refresh token set (jti-based rotation).
// A revoked token cannot be reused even if still within its TTL.
const revokedRefreshJtis = new Set<string>();

const router = Router();

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
}

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const basePayload = { sub: user.id, username: user.username, role: user.role ?? 'editor' };
  const accessToken = jwt.sign({ ...basePayload, type: 'access' }, JWT_SECRET, { expiresIn: JWT_ACCESS_TTL });
  const refreshToken = jwt.sign({ ...basePayload, type: 'refresh' }, JWT_SECRET, { expiresIn: JWT_REFRESH_TTL, jwtid: randomUUID() });

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
    const payload = jwt.verify(refresh_token, JWT_SECRET) as AuthPayload & { jti?: string };
    if (payload.type !== 'refresh') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    // Reject if this refresh token was already rotated (one-time use)
    const jti = payload.jti;
    if (jti && revokedRefreshJtis.has(jti)) {
      res.status(401).json({ error: 'Refresh token already used' });
      return;
    }

    // Verify user still exists
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(payload.sub) as Pick<UserRow, 'id' | 'username'> | undefined;
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const userWithRole = db.prepare('SELECT role FROM users WHERE id = ?').get(user.id) as { role: string } | undefined;
    const basePayload = { sub: user.id, username: user.username, role: userWithRole?.role ?? 'editor' };

    const accessToken = jwt.sign(
      { ...basePayload, type: 'access' },
      JWT_SECRET,
      { expiresIn: JWT_ACCESS_TTL }
    );

    // Rotate: issue a new refresh token and revoke the old one
    const newRefreshToken = jwt.sign(
      { ...basePayload, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: JWT_REFRESH_TTL, jwtid: randomUUID() }
    );

    if (jti) revokedRefreshJtis.add(jti);

    res.json({ access_token: accessToken, refresh_token: newRefreshToken, token_type: 'Bearer' });
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// GET /api/auth/me — return current user from DB (no password_hash)
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const row = db.prepare(
    'SELECT id, username, email, role, created_at FROM users WHERE id = ?'
  ).get(user.sub) as { id: string; username: string; email: string | null; role: string; created_at: string } | undefined;

  if (!row) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json(row);
});

// POST /api/auth/change-password — change own password
router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  const user = (req as Request & { user?: AuthPayload }).user;
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'currentPassword and newPassword are required' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: 'newPassword must be at least 8 characters' });
    return;
  }

  const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.sub) as
    | { password_hash: string }
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const match = await bcrypt.compare(currentPassword, row.password_hash);
  if (!match) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.sub);

  res.json({ message: 'Password updated successfully' });
});

export default router;
