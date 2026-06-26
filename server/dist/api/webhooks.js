import { Router } from 'express';
import { initDb } from '../db/schema.js';
import { queryOne, run } from '../db/query.js';
const router = Router();
function getRawBody(req) {
    if (typeof req.body === 'string')
        return req.body;
    if (Buffer.isBuffer(req.body))
        return req.body.toString('utf-8');
    return JSON.stringify(req.body);
}
// Stripe webhook — payment status updates (with signature verification)
router.post('/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    // Require webhook secret in production, skip verification in dev
    if (secret) {
        try {
            // Dynamic import to avoid top-level Stripe init
            const Stripe = (await import('stripe')).default;
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
            const rawBody = getRawBody(req);
            const event = stripe.webhooks.constructEvent(rawBody, sig, secret);
            await handleEvent(event);
        }
        catch (err) {
            console.error('[Stripe Webhook] Signature verification failed:', err.message);
            return res.status(400).json({ error: 'Invalid signature' });
        }
    }
    else if (process.env.NODE_ENV === 'development') {
        // Dev mode only: no webhook secret configured, trust req.body directly
        console.warn('[Stripe Webhook] No STRIPE_WEBHOOK_SECRET — trusting raw body (dev only)');
        await handleEvent(req.body);
    }
    else {
        console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured in production!');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    res.json({ received: true });
});
async function handleEvent(event) {
    switch (event.type) {
        case 'payment_intent.succeeded':
        case 'checkout.session.completed': {
            const invoiceId = event.data.object.metadata?.invoice_id;
            if (invoiceId) {
                await initDb();
                run('UPDATE invoices SET status = ? WHERE id = ?', ['paid', invoiceId]);
                // Notify photographer via SSE
                const inv = queryOne('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
                if (inv) {
                    try {
                        const { notifyInvoiceUpdated } = await import('../utils/events.js');
                        notifyInvoiceUpdated(inv.user_id, inv);
                    }
                    catch { }
                }
            }
            break;
        }
        case 'payment_intent.payment_failed': {
            const failId = event.data.object.metadata?.invoice_id;
            if (failId) {
                await initDb();
                run('UPDATE invoices SET status = ? WHERE id = ?', ['overdue', failId]);
            }
            break;
        }
        // ── Subscription lifecycle ──
        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
            const sub = event.data.object;
            const userId = sub.metadata?.userId;
            const priceId = sub.items?.data?.[0]?.price?.id;
            const status = sub.status; // active, past_due, canceled, incomplete
            if (userId && priceId) {
                await initDb();
                const plan = priceId === process.env.STRIPE_PRICE_PRO_ANNUAL ? 'pro_annual'
                    : priceId === process.env.STRIPE_PRICE_PRO ? 'pro'
                        : 'trial';
                if (status === 'active' || status === 'trialing') {
                    run('UPDATE users SET plan = ?, stripe_subscription_id = ? WHERE id = ?', [plan, sub.id, userId]);
                    console.log(`[Billing] User ${userId} upgraded to ${plan} (${status})`);
                }
                else if (status === 'past_due') {
                    // Keep current plan but log
                    console.log(`[Billing] User ${userId} subscription past_due`);
                }
                else if (status === 'canceled' || status === 'unpaid') {
                    run('UPDATE users SET plan = ?, stripe_subscription_id = NULL WHERE id = ?', ['trial', userId]);
                    console.log(`[Billing] User ${userId} downgraded to trial (${status})`);
                }
            }
            break;
        }
        case 'customer.subscription.deleted': {
            const sub = event.data.object;
            const userId = sub.metadata?.userId;
            if (userId) {
                await initDb();
                run('UPDATE users SET plan = ?, stripe_subscription_id = NULL WHERE id = ?', ['trial', userId]);
                console.log(`[Billing] User ${userId} subscription deleted → trial`);
            }
            break;
        }
    }
}
export { router as webhookRoutes };
