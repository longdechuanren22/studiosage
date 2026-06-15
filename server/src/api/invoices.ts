import { Router, type Router as RouterType } from 'express';
import { v4 as uuid } from 'uuid';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';
import { generateInvoiceData } from '../ai/engine.js';
import { StripeAdapter } from '../adapters/stripe.js';
import { generateInvoicePdf } from '../utils/pdf.js';

const router: RouterType = Router();

// List all invoices
router.get('/', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const invoices = queryAll(
    'SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [userId]
  );
  res.json(invoices);
});

// Get single invoice
router.get('/:id', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const invoice = queryOne(
    'SELECT * FROM invoices WHERE id = ? AND user_id = ?',
    [req.params.id, userId]
  );
  if (!invoice) return res.status(404).json({ error: '发票不存在' });
  res.json(invoice);
});

// Generate a new invoice (AI-powered)
router.post('/generate', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { clientName, clientEmail, packageType, amount, currency, paymentSchedule, notes } = req.body;
  if (!clientName || !amount) return res.status(400).json({ error: '客户名称和金额不能为空' });

  const id = uuid();

  const aiData = await generateInvoiceData({
    photographerName: req.body.photographerName || 'Photographer',
    photographerEmail: req.body.photographerEmail || '',
    clientName, clientEmail, packageType, amount: Number(amount),
    currency: currency || 'USD',
    paymentSchedule: paymentSchedule || 'single',
    additionalNotes: notes,
  });

  // Auto-lookup or create client by email
  let clientId: string | null = req.body.clientId || null;
  if (!clientId && clientEmail) {
    const existing = queryOne('SELECT id FROM clients WHERE email = ? AND user_id = ?', [clientEmail, userId]) as any;
    if (existing) clientId = existing.id;
  }

  run(
    `INSERT INTO invoices (id, user_id, client_id, client_name, client_email, amount, currency,
      description, items, payment_schedule, retainer_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, clientId, clientName, clientEmail, Number(amount), currency || 'USD',
      `${packageType || 'Service'} — ${clientName}`, JSON.stringify(aiData.items),
      paymentSchedule || 'single', aiData.retainerLabel || null, 'draft']
  );

  res.status(201).json({ id, ...aiData });
});

// Send invoice: generate Stripe payment link and mark as sent
router.post('/:id/send', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const invoice = queryOne('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, userId]) as any;
  if (!invoice) return res.status(404).json({ error: '发票不存在' });
  if (invoice.status === 'paid') return res.status(400).json({ error: '该发票已支付' });

  // Generate Stripe payment link if not already created
  let stripePaymentLink = invoice.stripe_payment_link;
  if (!stripePaymentLink) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey || stripeKey === 'sk_test_placeholder') {
      return res.status(400).json({ error: 'Stripe 未配置，请先在设置中连接 Stripe' });
    }

    try {
      const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
      // Ensure items have the right shape for Stripe
      const stripeItems = (items || [{ description: invoice.description, amount: invoice.amount, quantity: 1 }])
        .map((item: any) => ({
          description: item.description || invoice.description || 'Photography Service',
          amount: item.unitPrice || item.amount || invoice.amount,
          quantity: item.quantity || 1,
        }));

      const stripe = new StripeAdapter(stripeKey);
      const stripeResult = await stripe.createInvoice({
        clientName: invoice.client_name,
        clientEmail: invoice.client_email,
        items: stripeItems,
        paymentSchedule: invoice.payment_schedule || 'single',
        retainerLabel: invoice.retainer_type || undefined,
        invoiceId: invoice.id,
      });
      stripePaymentLink = stripeResult.paymentLink;

      run(
        'UPDATE invoices SET stripe_payment_link = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?',
        [stripePaymentLink, 'sent', invoice.id]
      );
    } catch (err) {
      console.error('[Stripe] Failed to create payment link:', (err as Error).message);
      return res.status(500).json({ error: '创建支付链接失败: ' + (err as Error).message });
    }
  } else {
    // Already has payment link, just mark as sent
    run(
      'UPDATE invoices SET status = ?, updated_at = datetime(\'now\') WHERE id = ?',
      ['sent', invoice.id]
    );
  }

  const updated = queryOne('SELECT * FROM invoices WHERE id = ?', [invoice.id]) as any;
  res.json({ ok: true, invoice: updated });
});

// Update invoice
router.patch('/:id', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { clientName, clientEmail, amount, currency, description, status } = req.body;
  const existing = queryOne('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, userId]) as any;
  if (!existing) return res.status(404).json({ error: '发票不存在' });

  run(
    `UPDATE invoices SET client_name=?, client_email=?, amount=?, currency=?, description=?, status=?, updated_at=datetime('now') WHERE id=?`,
    [
      clientName ?? existing.client_name,
      clientEmail ?? existing.client_email,
      amount ?? existing.amount,
      currency ?? existing.currency,
      description ?? existing.description,
      status ?? existing.status,
      req.params.id,
    ]
  );
  res.json({ ok: true });
});

// Delete (archive) invoice
router.delete('/:id', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const existing = queryOne('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!existing) return res.status(404).json({ error: '发票不存在' });
  if ((existing as any).status === 'paid') return res.status(400).json({ error: '已支付的发票不能删除' });

  run('DELETE FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  res.json({ ok: true });
});

// Generate PDF for invoice (for download/print)
router.get('/:id/pdf', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const invoice = queryOne('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!invoice) return res.status(404).json({ error: '发票不存在' });

  try {
    const inv = invoice as any;
    const pdfBuffer = await generateInvoicePdf({
      id: inv.id,
      clientName: inv.client_name,
      clientEmail: inv.client_email,
      amount: inv.amount,
      currency: inv.currency,
      description: inv.description,
      items: typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items,
      paymentSchedule: inv.payment_schedule,
      retainerLabel: inv.retainer_type,
      status: inv.status,
      stripePaymentLink: inv.stripe_payment_link,
      createdAt: inv.created_at,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${inv.id.slice(0, 8)}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[PDF] Generation failed:', err);
    res.status(500).json({ error: 'PDF 生成失败' });
  }
});

export { router as invoiceRoutes };
