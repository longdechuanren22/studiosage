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

export { router as authRoutes };
