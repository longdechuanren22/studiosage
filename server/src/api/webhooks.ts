import { Router, type Router as RouterType } from 'express';
import { initDb, saveDb } from '../db/schema.js';
import { run } from '../db/query.js';

const router: RouterType = Router();

// Stripe webhook — payment status updates
router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing signature' });

  try {
    const event = req.body;
    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'checkout.session.completed':
        const invoiceId = event.data.object.metadata?.invoice_id;
        if (invoiceId) {
          await initDb();
          run('UPDATE invoices SET status = ? WHERE id = ?', ['paid', invoiceId]);
          saveDb();
        }
        break;
      case 'payment_intent.payment_failed':
        const failId = event.data.object.metadata?.invoice_id;
        if (failId) {
          await initDb();
          run('UPDATE invoices SET status = ? WHERE id = ?', ['overdue', failId]);
          saveDb();
        }
        break;
    }
    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: 'Webhook error' });
  }
});

// Pixieset webhook — gallery status updates
router.post('/pixieset', async (req, res) => {
  const { event, gallery } = req.body;
  if (event === 'gallery.published' && gallery?.id) {
    await initDb();
    run('UPDATE clients SET metadata = ? WHERE pixieset_gallery_id = ?',
      [JSON.stringify({ galleryPublished: new Date().toISOString() }), gallery.id]);
    saveDb();
  }
  res.json({ received: true });
});

export { router as webhookRoutes };
