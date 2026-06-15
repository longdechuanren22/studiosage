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
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少6个字符'),
  name: z.string().min(1, '请输入姓名'),
});

const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(1, '请输入密码'),
});

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    await initDb();
    const { email, password, name } = req.body;

    const existing = queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      res.status(409).json({ ok: false, error: '该邮箱已注册', code: 'EMAIL_EXISTS' });
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
      res.status(401).json({ ok: false, error: '邮箱或密码不正确', code: 'INVALID_CREDENTIALS' });
      return;
    }

    // Support legacy users without password_hash (default user)
    if (!user.password_hash) {
      res.status(401).json({ ok: false, error: '该账号尚未设置密码，请先注册', code: 'NO_PASSWORD' });
      return;
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ ok: false, error: '邮箱或密码不正确', code: 'INVALID_CREDENTIALS' });
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
