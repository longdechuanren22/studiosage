import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';
import { generateInvoiceData } from '../ai/engine.js';
import { StripeAdapter } from '../adapters/stripe.js';
import { generateInvoicePdf } from '../utils/pdf.js';
const router = Router();
// List invoices with optional pagination
router.get('/', async (req, res) => {
    await initDb();
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;
    const invoices = queryAll('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?', [userId, limit, offset]);
    const total = queryOne('SELECT COUNT(*) as count FROM invoices WHERE user_id = ?', [userId])?.count || 0;
    res.json({ invoices, total, page, totalPages: Math.ceil(total / limit) });
});
// Get single invoice
router.get('/:id', async (req, res) => {
    await initDb();
    const userId = req.userId;
    const invoice = queryOne('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    if (!invoice)
        return res.status(404).json({ error: '发票不存在' });
    res.json(invoice);
});
// Generate a new invoice (AI-powered)
router.post('/generate', async (req, res) => {
    await initDb();
    const userId = req.userId;
    const { clientName, clientEmail, packageType, amount, currency, paymentSchedule, notes } = req.body;
    if (!clientName || !amount)
        return res.status(400).json({ ok: false, error: 'Client name and amount are required' });
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
    let clientId = req.body.clientId || null;
    if (!clientId && clientEmail) {
        const existing = queryOne('SELECT id FROM clients WHERE email = ? AND user_id = ?', [clientEmail, userId]);
        if (existing)
            clientId = existing.id;
    }
    run(`INSERT INTO invoices (id, user_id, client_id, client_name, client_email, amount, currency,
      description, items, payment_schedule, retainer_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, userId, clientId, clientName, clientEmail, Number(amount), currency || 'USD',
        `${packageType || 'Service'} — ${clientName}`, JSON.stringify(aiData.items),
        paymentSchedule || 'single', aiData.retainerLabel || null, 'draft']);
    res.status(201).json({ id, ...aiData });
});
// Send invoice: generate Stripe payment link and mark as sent
router.post('/:id/send', async (req, res) => {
    await initDb();
    const userId = req.userId;
    const invoice = queryOne('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    if (!invoice)
        return res.status(404).json({ error: '发票不存在' });
    if (invoice.status === 'paid')
        return res.status(400).json({ error: '该发票已支付' });
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
                .map((item) => ({
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
            run('UPDATE invoices SET stripe_payment_link = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?', [stripePaymentLink, 'sent', invoice.id]);
        }
        catch (err) {
            console.error('[Stripe] Failed to create payment link:', err.message);
            return res.status(500).json({ error: '创建支付链接失败: ' + err.message });
        }
    }
    else {
        // Already has payment link, just mark as sent
        run('UPDATE invoices SET status = ?, updated_at = datetime(\'now\') WHERE id = ?', ['sent', invoice.id]);
    }
    const updated = queryOne('SELECT * FROM invoices WHERE id = ?', [invoice.id]);
    res.json({ ok: true, invoice: updated });
    // Email payment link to client (best effort)
    if (updated?.client_email && updated?.stripe_payment_link) {
        try {
            const conn = queryOne("SELECT * FROM tool_connections WHERE user_id = ? AND tool_id = 'email_imap' AND status = 'active'", [userId]);
            if (conn) {
                const cfg = JSON.parse(conn.access_token_encrypted || '{}');
                const { decrypt } = await import('../utils/crypto.js');
                const password = conn.refresh_token_encrypted ? decrypt(conn.refresh_token_encrypted) : '';
                const { sendReply } = await import('../adapters/email.js');
                await sendReply({ ...cfg, password }, updated.client_email, `Invoice from StudioSage — ${updated.description}`, `Hi ${updated.client_name},\n\nHere's your invoice for ${updated.description}.\n\nAmount: $${updated.amount.toLocaleString()} ${updated.currency}\nPayment Schedule: ${updated.payment_schedule === 'three-phase' ? '3-Phase (50/25/25)' : 'Full Payment'}\n\nPay online: ${updated.stripe_payment_link}\n\nThank you for your business!\n\n— Powered by StudioSage`);
            }
        }
        catch { /* Best effort */ }
    }
});
// Update invoice
router.patch('/:id', async (req, res) => {
    await initDb();
    const userId = req.userId;
    const { clientName, clientEmail, amount, currency, description, status } = req.body;
    const existing = queryOne('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    if (!existing)
        return res.status(404).json({ error: '发票不存在' });
    run(`UPDATE invoices SET client_name=?, client_email=?, amount=?, currency=?, description=?, status=?, updated_at=datetime('now') WHERE id=?`, [
        clientName ?? existing.client_name,
        clientEmail ?? existing.client_email,
        amount ?? existing.amount,
        currency ?? existing.currency,
        description ?? existing.description,
        status ?? existing.status,
        req.params.id,
    ]);
    res.json({ ok: true });
});
// Delete (archive) invoice
router.delete('/:id', async (req, res) => {
    await initDb();
    const userId = req.userId;
    const existing = queryOne('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    if (!existing)
        return res.status(404).json({ error: '发票不存在' });
    if (existing.status === 'paid')
        return res.status(400).json({ error: '已支付的发票不能删除' });
    run('DELETE FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    res.json({ ok: true });
});
// Generate PDF for invoice (for download/print)
router.get('/:id/pdf', async (req, res) => {
    await initDb();
    const userId = req.userId;
    const invoice = queryOne('SELECT * FROM invoices WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    if (!invoice)
        return res.status(404).json({ error: '发票不存在' });
    try {
        const inv = invoice;
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
    }
    catch (err) {
        console.error('[PDF] Generation failed:', err);
        res.status(500).json({ error: 'PDF 生成失败' });
    }
});
// Export invoices as CSV
router.get('/export/csv', async (req, res) => {
    await initDb();
    const userId = req.userId;
    const invoices = queryAll(`SELECT client_name, client_email, amount, currency, description, status, payment_schedule, stripe_payment_link, created_at
     FROM invoices WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
    const header = 'Client,Email,Amount,Currency,Description,Status,Schedule,PaymentLink,Created\n';
    const rows = invoices.map(i => `"${(i.client_name || '').replace(/"/g, '""')}","${(i.client_email || '').replace(/"/g, '""')}",${i.amount},"${i.currency}","${(i.description || '').replace(/"/g, '""')}","${i.status}","${i.payment_schedule}","${i.stripe_payment_link || ''}","${i.created_at}"`).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="studiosage-invoices.csv"');
    res.send('﻿' + header + rows);
});
export { router as invoiceRoutes };
