import { Router, type Router as RouterType } from 'express';
import { initDb } from '../db/schema.js';
import { queryOne, run } from '../db/query.js';

const router: RouterType = Router();

function getRawBody(req: any): string {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf-8');
  return JSON.stringify(req.body);
}

// Stripe webhook — payment status updates (with signature verification)
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  // Require webhook secret in production, skip verification in dev
  if (secret) {
    try {
      // Dynamic import to avoid top-level Stripe init
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const rawBody = getRawBody(req);
      const event = stripe.webhooks.constructEvent(rawBody, sig, secret);
      await handleEvent(event);
    } catch (err: any) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } else {
    // Dev mode: no webhook secret configured, trust req.body directly
    console.warn('[Stripe Webhook] No STRIPE_WEBHOOK_SECRET — trusting raw body (dev only)');
    await handleEvent(req.body);
  }

  res.json({ received: true });
});

async function handleEvent(event: any) {
  switch (event.type) {
    case 'payment_intent.succeeded':
    case 'checkout.session.completed': {
      const invoiceId = event.data.object.metadata?.invoice_id;
      if (invoiceId) {
        await initDb();
        run('UPDATE invoices SET status = ? WHERE id = ?', ['paid', invoiceId]);
        // Notify photographer via SSE
        const inv = queryOne('SELECT * FROM invoices WHERE id = ?', [invoiceId]) as any;
        if (inv) {
          try {
            const { notifyInvoiceUpdated } = await import('../utils/events.js');
            notifyInvoiceUpdated(inv.user_id, inv);
          } catch {}
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
  }
}

// Pixieset webhook — gallery status updates
router.post('/pixieset', async (req, res) => {
  const { event, gallery } = req.body;
  if (event === 'gallery.published' && gallery?.id) {
    await initDb();
    run('UPDATE clients SET metadata = ? WHERE pixieset_gallery_id = ?',
      [JSON.stringify({ galleryPublished: new Date().toISOString() }), gallery.id]);
  }
  res.json({ received: true });
});

export { router as webhookRoutes };
