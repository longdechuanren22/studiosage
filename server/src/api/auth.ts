import { Router, type Router as RouterType } from 'express';
import { randomUUID } from 'node:crypto';
import { initDb } from '../db/schema.js';
import { queryOne, run } from '../db/query.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { signToken, authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router: RouterType = Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    await initDb();
    const { email, password, name } = req.body;

    const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      res.status(409).json({ ok: false, error: 'Email already registered', code: 'EMAIL_EXISTS' });
      return;
    }

    const id = randomUUID();
    const passwordHash = await hashPassword(password);
    run(
      'INSERT INTO users (id, email, name, password_hash, plan) VALUES (?, ?, ?, ?, ?)',
      [id, email, name, passwordHash, 'trial']
    );

    const token = signToken({ userId: id, email });
    res.status(201).json({
      ok: true,
      user: { id, email, name, plan: 'trial' },
      token,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    await initDb();
    const { email, password } = req.body;

    const user = queryOne('SELECT * FROM users WHERE email = ?', [email]) as any;
    if (!user) {
      res.status(401).json({ ok: false, error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
      return;
    }

    if (!user.password_hash) {
      res.status(401).json({ ok: false, error: 'Account not set up. Please register first.', code: 'NO_PASSWORD' });
      return;
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ ok: false, error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
      return;
    }

    const token = signToken({ userId: user.id, email: user.email });
    res.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
      token,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — get current user from token
router.get('/me', authenticate, async (req, res, next) => {
  try {
    await initDb();
    const user = queryOne('SELECT id, email, name, plan, created_at FROM users WHERE id = ?', [req.userId]) as any;
    if (!user) {
      res.status(404).json({ ok: false, error: '用户不存在', code: 'USER_NOT_FOUND' });
      return;
    }
    res.json({ ok: true, user });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password — send reset link
router.post('/forgot-password', async (req, res) => {
  await initDb();
  const { email } = req.body;
  if (!email) return res.status(400).json({ ok: false, error: 'Email is required' });

  const user = queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (!user) return res.json({ ok: true, message: 'If the email exists, a reset link has been sent.' });

  const token = randomUUID();
  run('UPDATE users SET password_hash = ? WHERE id = ?', [token, (user as any).id]);
  // In production: send email with link. For now: return token directly (dev mode).
  res.json({ ok: true, message: 'Reset token generated', token: process.env.NODE_ENV === 'production' ? undefined : token });
});

// POST /api/auth/reset-password — reset with token
router.post('/reset-password', async (req, res) => {
  await initDb();
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ ok: false, error: 'Token and new password are required' });
  if (newPassword.length < 6) return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });

  const user = queryOne('SELECT id FROM users WHERE password_hash = ?', [token]) as any;
  if (!user) return res.status(400).json({ ok: false, error: 'Invalid or expired reset token' });

  const passwordHash = await hashPassword(newPassword);
  run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
  res.json({ ok: true, message: 'Password has been reset. You can now login.' });
});

// PATCH /api/auth/profile — update name/email
router.patch('/profile', authenticate, async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { name, email } = req.body;
  if (email) {
    const existing = queryOne('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (existing) return res.status(409).json({ ok: false, error: 'Email already in use' });
  }
  const user = queryOne('SELECT * FROM users WHERE id = ?', [userId]) as any;
  run('UPDATE users SET name = ?, email = ? WHERE id = ?', [name || user.name, email || user.email, userId]);
  res.json({ ok: true, user: { id: userId, name: name || user.name, email: email || user.email, plan: user.plan } });
});

// POST /api/auth/change-password — requires current password
router.post('/change-password', authenticate, async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ ok: false, error: 'Current and new password required' });
  if (newPassword.length < 6) return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' });

  const user = queryOne('SELECT * FROM users WHERE id = ?', [userId]) as any;
  if (!user.password_hash) return res.status(400).json({ ok: false, error: 'Account uses legacy auth' });
  const valid = await verifyPassword(currentPassword, user.password_hash);
  if (!valid) return res.status(400).json({ ok: false, error: 'Current password is incorrect' });

  const hash = await hashPassword(newPassword);
  run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
  res.json({ ok: true });
});

export { router as authRoutes };
