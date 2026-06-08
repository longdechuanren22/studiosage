import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { initDb, saveDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';
import { generateInvoiceData } from '../ai/engine.js';
const router = Router();
router.get('/', async (_req, res) => {
    await initDb();
    const invoices = queryAll('SELECT * FROM invoices ORDER BY created_at DESC LIMIT 30');
    res.json(invoices);
});
router.post('/generate', async (req, res) => {
    await initDb();
    const { clientName, clientEmail, packageType, amount, currency, paymentSchedule, notes } = req.body;
    const id = uuid();
    const aiData = await generateInvoiceData({
        photographerName: req.body.photographerName || 'Photographer',
        photographerEmail: req.body.photographerEmail || '',
        clientName, clientEmail, packageType, amount: Number(amount),
        currency: currency || 'USD',
        paymentSchedule: paymentSchedule || 'single',
        additionalNotes: notes,
    });
    run(`INSERT INTO invoices (id, user_id, client_name, client_email, amount, currency, description, items, payment_schedule, retainer_type, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, 'default', clientName, clientEmail, Number(amount), currency || 'USD',
        `${packageType} — ${clientName}`, JSON.stringify(aiData.items),
        paymentSchedule || 'single', aiData.retainerLabel || null, 'draft']);
    saveDb();
    res.json({ id, ...aiData });
});
router.get('/:id/pdf', async (req, res) => {
    await initDb();
    const invoice = queryOne('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    if (!invoice)
        return res.status(404).json({ error: 'Not found' });
    res.json({ ...invoice, pdfUrl: `/api/invoices/${req.params.id}/pdf` });
});
export { router as invoiceRoutes };
