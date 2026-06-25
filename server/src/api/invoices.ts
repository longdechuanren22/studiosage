import { Router, type Router as RouterType } from 'express';
import { v4 as uuid } from 'uuid';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';
import { generateInvoiceData } from '../ai/engine.js';
import { StripeAdapter } from '../adapters/stripe.js';
import { generateInvoicePdf } from '../utils/pdf.js';

const router: RouterType = Router();

// List invoices with optional pagination
router.get('/', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = (page - 1) * limit;

  const invoices = queryAll(
    'SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [userId, limit, offset]
  );
  const total = (queryOne('SELECT COUNT(*) as count FROM invoices WHERE user_id = ?', [userId]) as any)?.count || 0;

  res.json({ invoices, total, page, totalPages: Math.ceil(total / limit) });
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

// Generate a new invoice (AI-powered) with sequential numbering
router.post('/generate', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { clientName, clientEmail, packageType, amount, currency, paymentSchedule, notes } = req.body;
  if (!clientName || !amount) return res.status(400).json({ ok: false, error: 'Client name and amount are required' });

  const id = uuid();

  // Sequential invoice number: INV-{year}-{seq:04d}
  const year = new Date().getFullYear();
  const lastInv = queryOne(
    "SELECT invoice_number FROM invoices WHERE user_id = ? AND invoice_number LIKE 'INV-' || ? || '-%' ORDER BY invoice_number DESC LIMIT 1",
    [userId, String(year)]
  ) as any;
  const seq = lastInv?.invoice_number ? parseInt(lastInv.invoice_number.split('-').pop() || '0') + 1 : 1;
  const invoiceNumber = `INV-${year}-${String(seq).padStart(4, '0')}`;

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
      description, items, payment_schedule, retainer_type, status, invoice_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, clientId, clientName, clientEmail, Number(amount), currency || 'USD',
      `${packageType || 'Service'} — ${clientName}`, JSON.stringify(aiData.items),
      paymentSchedule || 'single', aiData.retainerLabel || null, 'draft', invoiceNumber]
  );

  res.status(201).json({ id, invoiceNumber, ...aiData });
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

  // Email payment link to client (best effort)
  if (updated?.client_email && updated?.stripe_payment_link) {
    try {
      const conn = queryOne("SELECT * FROM tool_connections WHERE user_id = ? AND tool_id = 'email_imap' AND status = 'active'", [userId]) as any;
      if (conn) {
        const cfg = JSON.parse(conn.access_token_encrypted || '{}');
        const { decrypt } = await import('../utils/crypto.js');
        const password = conn.refresh_token_encrypted ? decrypt(conn.refresh_token_encrypted) : '';
        const { sendReply } = await import('../adapters/email.js');
        await sendReply({ ...cfg, password }, updated.client_email,
          `Invoice from StudioSage — ${updated.description}`,
          `Hi ${updated.client_name},\n\nHere's your invoice for ${updated.description}.\n\nAmount: $${updated.amount.toLocaleString()} ${updated.currency}\nPayment Schedule: ${updated.payment_schedule === 'three-phase' ? '3-Phase (50/25/25)' : 'Full Payment'}\n\nPay online: ${updated.stripe_payment_link}\n\nThank you for your business!\n\n— Powered by StudioSage`
        );
      }
    } catch { /* Best effort */ }
  }
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

// Export invoices as CSV
router.get('/export/csv', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const invoices = queryAll(
    `SELECT client_name, client_email, amount, currency, description, status, payment_schedule, stripe_payment_link, created_at
     FROM invoices WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  ) as any[];

  const header = 'Client,Email,Amount,Currency,Description,Status,Schedule,PaymentLink,Created\n';
  const rows = invoices.map(i =>
    `"${(i.client_name || '').replace(/"/g, '""')}","${(i.client_email || '').replace(/"/g, '""')}",${i.amount},"${i.currency}","${(i.description || '').replace(/"/g, '""')}","${i.status}","${i.payment_schedule}","${i.stripe_payment_link || ''}","${i.created_at}"`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="studiosage-invoices.csv"');
  res.send('﻿' + header + rows);
});

export { router as invoiceRoutes };
