import { Router, type Router as RouterType } from 'express';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';
import { authenticateClient } from '../middleware/clientAuth.js';

const router: RouterType = Router();

// Get proposals shared with this client (token-based, no JWT)
router.get('/proposal/:shareToken', async (req, res) => {
  await initDb();
  const proposal = queryOne(
    `SELECT p.*, c.name as client_name, c.email as client_email
     FROM proposals p LEFT JOIN clients c ON p.client_id = c.id
     WHERE p.share_token = ?`,
    [req.params.shareToken]
  );
  if (!proposal) return res.status(404).json({ error: '提案不存在或链接已失效' });

  const p = proposal as any;
  run('UPDATE proposals SET status = CASE WHEN status = ? THEN ? ELSE status END WHERE share_token = ?',
    ['sent', 'viewed', req.params.shareToken]);

  res.json({
    id: p.id,
    title: p.title,
    clientName: p.client_name,
    packages: typeof p.packages === 'string' ? JSON.parse(p.packages) : p.packages,
    pricing: typeof p.pricing === 'string' ? JSON.parse(p.pricing) : p.pricing,
    contractTerms: p.contract_terms,
    status: p.status,
  });
});

// Client accepts a proposal
router.post('/proposal/:shareToken/accept', async (req, res) => {
  await initDb();
  const proposal = queryOne('SELECT * FROM proposals WHERE share_token = ?', [req.params.shareToken]);
  if (!proposal) return res.status(404).json({ error: '提案不存在' });

  const p = proposal as any;
  run('UPDATE proposals SET status = ?, updated_at = datetime(\'now\') WHERE share_token = ?',
    ['accepted', req.params.shareToken]);
  if (p.client_id) {
    run("UPDATE clients SET stage = 'booked', updated_at = datetime('now') WHERE id = ?", [p.client_id]);
  }
  res.json({ ok: true, message: '提案已接受！' });
});

// ── Authenticated client routes (via client token) ──

// Get client's own messages
router.get('/messages', authenticateClient, async (req, res) => {
  await initDb();
  const clientId = (req as any).clientId;
  const messages = queryAll(
    'SELECT id, subject, body, status, created_at FROM messages WHERE client_id = ? AND status != ? ORDER BY created_at DESC LIMIT 50',
    [clientId, 'archived']
  );
  res.json(messages);
});

// Client sends a message
router.post('/messages', authenticateClient, async (req, res) => {
  await initDb();
  const clientId = (req as any).clientId;
  const userId = (req as any).clientUserId;
  const { subject, body } = req.body;
  if (!body) return res.status(400).json({ error: '消息内容不能为空' });

  const { randomUUID } = await import('node:crypto');
  run(
    `INSERT INTO messages (id, user_id, client_id, from_address, subject, body, category, status, channel, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'normal', 'pending', 'portal', datetime('now'))`,
    [randomUUID(), userId, clientId, (req as any).clientEmail || '', subject || '', body]
  );
  res.status(201).json({ ok: true });
});

// Get client's invoices
router.get('/invoices', authenticateClient, async (req, res) => {
  await initDb();
  const clientId = (req as any).clientId;
  const invoices = queryAll(
    'SELECT id, amount, currency, description, status, stripe_payment_link, created_at FROM invoices WHERE client_id = ? ORDER BY created_at DESC LIMIT 20',
    [clientId]
  );
  res.json(invoices);
});

export { router as portalRoutes };
