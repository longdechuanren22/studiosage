import { Router, type Router as RouterType } from 'express';
import { randomUUID } from 'node:crypto';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';

const router: RouterType = Router();

// List proposals for current user
router.get('/', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const proposals = queryAll(
    `SELECT p.*, c.name as client_name, c.email as client_email
     FROM proposals p LEFT JOIN clients c ON p.client_id = c.id
     WHERE p.user_id = ?
     ORDER BY p.updated_at DESC LIMIT 30`,
    [userId]
  );
  res.json(proposals);
});

// Get single proposal
router.get('/:id', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const proposal = queryOne(
    `SELECT p.*, c.name as client_name, c.email as client_email
     FROM proposals p LEFT JOIN clients c ON p.client_id = c.id
     WHERE p.id = ? AND p.user_id = ?`,
    [req.params.id, userId]
  );
  if (!proposal) return res.status(404).json({ error: '提案不存在' });
  res.json(proposal);
});

// Create proposal
router.post('/', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { clientId, title, packages, pricing, contractTerms } = req.body;
  if (!title) return res.status(400).json({ error: '提案标题不能为空' });

  const id = randomUUID();
  const shareToken = randomUUID().replace(/-/g, '');
  run(
    `INSERT INTO proposals (id, user_id, client_id, title, packages, pricing, contract_terms, share_token, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
    [id, userId, clientId || null, title,
     JSON.stringify(packages || []), JSON.stringify(pricing || {}),
     contractTerms || '', shareToken]
  );
  res.status(201).json({ id, shareToken });
});

// Update proposal
router.patch('/:id', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { title, packages, pricing, contractTerms, status } = req.body;
  const existing = queryOne('SELECT * FROM proposals WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!existing) return res.status(404).json({ error: '提案不存在' });

  const e = existing as any;
  run(
    `UPDATE proposals SET title=?, packages=?, pricing=?, contract_terms=?, status=?, updated_at=datetime('now') WHERE id=?`,
    [title || e.title, packages ? JSON.stringify(packages) : e.packages,
     pricing ? JSON.stringify(pricing) : e.pricing,
     contractTerms || e.contract_terms, status || e.status, req.params.id]
  );
  res.json({ ok: true });
});

// Generate share token
router.post('/:id/share', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const proposal = queryOne('SELECT * FROM proposals WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!proposal) return res.status(404).json({ error: '提案不存在' });

  const shareToken = randomUUID().replace(/-/g, '');
  run('UPDATE proposals SET share_token = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [shareToken, 'sent', req.params.id]);
  res.json({ shareToken, shareUrl: `/portal/proposal/${shareToken}` });
});

export { router as proposalRoutes };
