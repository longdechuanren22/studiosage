import { Router } from 'express';
import { initDb } from '../db/schema.js';
import { queryOne, run } from '../db/query.js';
import { getAIStatus } from '../ai/engine.js';
const router = Router();
// Check what's configured
router.get('/', async (req, res) => {
    const userId = req.userId;
    let emailConnected = false;
    let emailProvider = '';
    let autoReply = true;
    try {
        await initDb();
        const row = queryOne("SELECT * FROM tool_connections WHERE user_id = ? AND tool_id = 'email_imap' AND status = 'active'", [userId]);
        if (row) {
            emailConnected = true;
            const cfg = JSON.parse(row.access_token_encrypted || '{}');
            emailProvider = cfg.email || '';
            autoReply = cfg.autoReply !== false; // default true
        }
    }
    catch (_) { /* DB may not be ready */ }
    res.json({
        ai: { configured: !!(process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY), ...getAIStatus() },
        email: { connected: emailConnected, email: emailProvider, autoReply },
        stripe: { configured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'sk_test_placeholder') },
        setupComplete: !!((process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY) &&
            process.env.STRIPE_SECRET_KEY &&
            process.env.STRIPE_SECRET_KEY !== 'sk_test_placeholder'),
    });
});
// Toggle auto-reply preference
router.patch('/auto-reply', async (req, res) => {
    const userId = req.userId;
    const { enabled } = req.body;
    await initDb();
    const row = queryOne("SELECT * FROM tool_connections WHERE user_id = ? AND tool_id = 'email_imap' AND status = 'active'", [userId]);
    if (row) {
        const cfg = JSON.parse(row.access_token_encrypted || '{}');
        cfg.autoReply = !!enabled;
        run("UPDATE tool_connections SET access_token_encrypted = ? WHERE id = ?", [JSON.stringify(cfg), row.id]);
        res.json({ ok: true, autoReply: cfg.autoReply });
    }
    else {
        res.json({ ok: false, error: 'Email not connected' });
    }
});
export { router as settingsRoutes };
