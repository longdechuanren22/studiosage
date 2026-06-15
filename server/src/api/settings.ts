import { Router, type Router as RouterType } from 'express';
import { initDb } from '../db/schema.js';
import { queryOne } from '../db/query.js';

const router: RouterType = Router();

// Check what's configured
router.get('/', async (req, res) => {
  const userId = req.userId!;
  let emailConnected = false;
  let emailProvider = '';
  try {
    await initDb();
    const row = queryOne("SELECT * FROM tool_connections WHERE user_id = ? AND tool_id = 'email_imap' AND status = 'active'", [userId]);
    if (row) {
      emailConnected = true;
      const cfg = JSON.parse((row as any).access_token_encrypted || '{}');
      emailProvider = cfg.email || '';
    }
  } catch (_) { /* DB may not be ready */ }

  res.json({
    ai: { configured: !!(process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY) },
    email: { connected: emailConnected, email: emailProvider },
    google: { configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) },
    gmail: { connected: !!process.env.GOOGLE_ACCESS_TOKEN },
    pixieset: { configured: !!process.env.PIXIESET_API_KEY },
    stripe: { configured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_placeholder') },
    setupComplete: !!(
      (process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY) &&
      process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_SECRET_KEY !== 'sk_test_placeholder'
    ),
  });
});

export { router as settingsRoutes };
