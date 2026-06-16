import { Router, type Router as RouterType } from 'express';
import { initDb, isDbReady } from '../db/schema.js';
import { queryOne } from '../db/query.js';
import fs from 'node:fs';
import path from 'node:path';

const router: RouterType = Router();

router.get('/', async (_req, res) => {
  const checks: Record<string, boolean> = {};
  try { await initDb(); checks.database = true; } catch { checks.database = false; }
  checks.ai = !!process.env.ANTHROPIC_API_KEY || !!process.env.DEEPSEEK_API_KEY;
  checks.stripe = !!process.env.STRIPE_SECRET_KEY;
  checks.google = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  checks.pixieset = !!process.env.PIXIESET_API_KEY;
  const allOk = Object.values(checks).every(v => v);
  res.status(allOk ? 200 : 503).json({ status: allOk ? 'healthy' : 'degraded', checks, uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// Data integrity check
router.get('/data', async (_req, res) => {
  try {
    await initDb();
    const users = (queryOne('SELECT COUNT(*) as c FROM users') as any)?.c || 0;
    const clients = (queryOne('SELECT COUNT(*) as c FROM clients') as any)?.c || 0;
    const messages = (queryOne('SELECT COUNT(*) as c FROM messages') as any)?.c || 0;
    const invoices = (queryOne('SELECT COUNT(*) as c FROM invoices') as any)?.c || 0;
    const dbFile = fs.existsSync(path.join(process.cwd(), 'data', 'studiosage.db'));
    const bakFile = fs.existsSync(path.join(process.cwd(), 'data', 'studiosage.db.bak'));
    res.json({ ok: true, dbReady: isDbReady(), dbFile, backupFile: bakFile, counts: { users, clients, messages, invoices } });
  } catch (err) { res.status(500).json({ ok: false, error: (err as Error).message }); }
});

export { router as healthRoutes };
