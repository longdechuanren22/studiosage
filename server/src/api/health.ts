import { Router, type Router as RouterType } from 'express';
import { initDb } from '../db/schema.js';

const router: RouterType = Router();

router.get('/', async (_req, res) => {
  const checks: Record<string, boolean> = {};

  // DB check
  try {
    await initDb();
    checks.database = true;
  } catch { checks.database = false; }

  // External service checks (non-blocking)
  checks.ai = !!process.env.ANTHROPIC_API_KEY;
  checks.stripe = !!process.env.STRIPE_SECRET_KEY;
  checks.google = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  checks.pixieset = !!process.env.PIXIESET_API_KEY;

  const allOk = Object.values(checks).every(v => v);
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    checks,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export { router as healthRoutes };
