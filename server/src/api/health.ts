import { Router, type Router as RouterType } from 'express';
import { initDb, isDbReady } from '../db/schema.js';
import { queryOne } from '../db/query.js';
import fs from 'node:fs';
import path from 'node:path';

const router: RouterType = Router();

// Liveness probe (always returns 200 if process is running)
router.get('/live', (_req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

// Full health check with dependency status
router.get('/', async (_req, res) => {
  const checks: Record<string, boolean> = {};
  try { await initDb(); checks.database = true; } catch { checks.database = false; }
  checks.ai = !!process.env.ANTHROPIC_API_KEY || !!process.env.DEEPSEEK_API_KEY;
  checks.stripe = !!process.env.STRIPE_SECRET_KEY;

  // AI status detail
  let aiStatus: any = { configured: checks.ai };
  try {
    const { getAIStatus } = await import('../ai/engine.js');
    aiStatus = getAIStatus();
  } catch { aiStatus = { configured: checks.ai, error: 'unavailable' }; }

  const allOk = Object.values(checks).every(v => v);
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    aiStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Readiness probe (all critical dependencies)
router.get('/ready', async (_req, res) => {
  const ready: Record<string, boolean> = {};
  try { await initDb(); const row = queryOne('SELECT 1 as ok'); ready.db = !!row; } catch { ready.db = false; }
  ready.jwt = !!process.env.JWT_SECRET;
  const allReady = Object.values(ready).every(v => v);
  res.status(allReady ? 200 : 503).json({ ready: allReady, checks: ready, uptime: process.uptime() });
});

// Data integrity check
router.get('/data', async (_req, res) => {
  try {
    await initDb();
    const users = (queryOne('SELECT COUNT(*) as c FROM users') as any)?.c || 0;
    const clients = (queryOne('SELECT COUNT(*) as c FROM clients') as any)?.c || 0;
    const messages = (queryOne('SELECT COUNT(*) as c FROM messages') as any)?.c || 0;
    const invoices = (queryOne('SELECT COUNT(*) as c FROM invoices') as any)?.c || 0;
    const projects = (queryOne('SELECT COUNT(*) as c FROM projects') as any)?.c || 0;
    const dbFile = fs.existsSync(path.join(process.cwd(), 'data', 'studiosage.db'));
    const bakFile = fs.existsSync(path.join(process.cwd(), 'data', 'studiosage.db.bak'));
    const dbSize = dbFile ? fs.statSync(path.join(process.cwd(), 'data', 'studiosage.db')).size : 0;
    res.json({ ok: true, dbReady: isDbReady(), dbFile, backupFile: bakFile, dbSizeBytes: dbSize, counts: { users, clients, messages, invoices, projects } });
  } catch (err) { res.status(500).json({ ok: false, error: (err as Error).message }); }
});

export { router as healthRoutes };
