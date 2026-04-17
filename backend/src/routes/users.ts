import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/schema';
import { requireAdmin, AuthPayload } from '../middleware/auth';
import { apiError } from '../utils/errors';

const router = Router();

const VALID_ROLES = ['admin', 'editor'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/users
router.get('/', (_req: Request, res: Response) => {
  const users = db.prepare('SELECT id, username, role, email, created_at FROM users ORDER BY created_at ASC').all();
  res.json(users);
});

// POST /api/users
router.post('/', requireAdmin, (req: Request, res: Response) => {
  const { username, password, role, email } = req.body as {
    username?: string;
    password?: string;
    role?: string;
    email?: string;
  };

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    res.status(400).json({ error: 'username is required' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'password must be at least 6 characters' });
    return;
  }
  if (email !== undefined && email !== null && email !== '' && !EMAIL_REGEX.test(email)) {
    apiError(res, 400, 'email format is invalid');
    return;
  }
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    apiError(res, 400, `role must be one of: ${VALID_ROLES.join(', ')}`);
    return;
  }

  const resolvedRole = VALID_ROLES.includes(role ?? '') ? role! : 'editor';

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO users (id, username, password_hash, role, email) VALUES (?, ?, ?, ?, ?)').run(
    id, username.trim(), hash, resolvedRole, email ?? null
  );

  const user = db.prepare('SELECT id, username, role, email, created_at FROM users WHERE id = ?').get(id);
  res.status(201).json(user);
});

// PATCH /api/users/:id
router.patch('/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { role, email, password } = req.body as { role?: string; email?: string; password?: string };

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (role !== undefined) {
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ error: 'role must be admin or editor' });
      return;
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  }

  if (email !== undefined) {
    if (email !== null && email !== '' && !EMAIL_REGEX.test(email)) {
      apiError(res, 400, 'email format is invalid');
      return;
    }
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email || null, id);
  }

  if (password) {
    if (password.length < 6) {
      res.status(400).json({ error: 'password must be at least 6 characters' });
      return;
    }
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
  }

  const updated = db.prepare('SELECT id, username, role, email, created_at FROM users WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/users/:id
router.delete('/:id', requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const currentUser = (req as Request & { user?: AuthPayload }).user;

  if (currentUser?.sub === id) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.status(204).send();
});

export default router;
