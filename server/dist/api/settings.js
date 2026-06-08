import { Router } from 'express';
const router = Router();
// Check what's configured
router.get('/', async (_req, res) => {
    res.json({
        ai: { configured: !!process.env.ANTHROPIC_API_KEY },
        pixieset: { configured: !!process.env.PIXIESET_API_KEY },
        googleCalendar: { configured: !!process.env.GOOGLE_CLIENT_ID },
        stripe: { configured: !!process.env.STRIPE_SECRET_KEY },
        setupComplete: !!(process.env.ANTHROPIC_API_KEY && process.env.STRIPE_SECRET_KEY),
    });
});
export { router as settingsRoutes };
