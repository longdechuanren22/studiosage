import { Router, type Router as RouterType } from 'express';
import { randomUUID } from 'node:crypto';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';
import { callAI } from '../ai/engine.js';

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

// AI-generate proposal from client chat history
router.post('/generate-from-chat', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { clientId } = req.body;

  if (!clientId) return res.status(400).json({ error: 'Missing clientId' });

  // Get client info
  const client = queryOne('SELECT * FROM clients WHERE id = ? AND user_id = ?', [clientId, userId]) as any;
  if (!client) return res.status(404).json({ error: 'Client not found' });

  // Get client's messages
  const messages = queryAll(
    'SELECT from_address, subject, body, created_at FROM messages WHERE client_id = ? AND user_id = ? AND category != ? ORDER BY created_at ASC LIMIT 20',
    [clientId, userId, 'spam']
  ) as any[];

  if (messages.length === 0) {
    return res.status(400).json({ error: 'No messages found for this client. Chat with them first.' });
  }

  // Build conversation summary
  const chatSummary = messages.map(m =>
    `[${m.created_at}] ${m.from_address}: ${m.subject}\n${(m.body || '').slice(0, 500)}`
  ).join('\n---\n');

  const clientInfo = {
    name: client.name,
    email: client.email,
    type: client.type || 'unknown',
    stage: client.stage,
  };

  try {
    // Try AI generation
    const prompt = `You are a photographer's assistant. Based on the chat history below with a client, generate a professional photography proposal.

Client info: ${JSON.stringify(clientInfo)}

Chat history:
${chatSummary.slice(0, 3000)}

Output valid JSON only (no markdown):
{
  "title": "Proposal title (e.g., 'Sarah & Mike Wedding Photography')",
  "packages": [{"name": "Premium", "price": 4500, "includes": ["item1","item2"]}, {"name": "Standard", "price": 2800, "includes": ["item1"]}, {"name": "Basic", "price": 1200, "includes": ["item1"]}],
  "pricing": {"Service A": 2500, "Service B": 1000},
  "contractTerms": "1. 50% retainer confirms the date, non-refundable.\\n2. 25% due on shoot day.\\n3. 25% due before delivery."
}`;

    const aiText = await callAI(prompt, 800, 0.4);
    const cleaned = aiText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const generated = JSON.parse(cleaned);

    // Create the proposal in DB
    const id = randomUUID();
    const shareToken = randomUUID().replace(/-/g, '');
    run(
      `INSERT INTO proposals (id, user_id, client_id, title, packages, pricing, contract_terms, share_token, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [id, userId, clientId, generated.title || `${client.name} Proposal`,
       JSON.stringify(generated.packages || []), JSON.stringify(generated.pricing || {}),
       generated.contractTerms || '', shareToken]
    );

    return res.status(201).json({
      id, shareToken,
      title: generated.title,
      packages: generated.packages,
      pricing: generated.pricing,
      contractTerms: generated.contractTerms,
      generated: true,
    });
  } catch (err) {
    console.error('[AI Proposal] Failed, using template:', (err as Error).message);

    // Fallback: template-based proposal from chat context
    const chatText = messages.map(m => m.subject + ' ' + (m.body || '').slice(0, 200)).join(' ');
    const pkgType = client.type || 'wedding';
    const basePrice = pkgType === 'wedding' ? 3500 : pkgType === 'portrait' ? 450 : pkgType === 'event' ? 1800 : 2000;
    const title = `${client.name} ${pkgType.charAt(0).toUpperCase() + pkgType.slice(1)} Photography`;

    const multiPackages = [
      { name: 'Premium', price: basePrice, includes: ['Full day coverage', '2 photographers', 'Album', 'All edited images', 'Online gallery'] },
      { name: 'Standard', price: Math.round(basePrice * 0.7), includes: ['6 hours coverage', '1 photographer', 'Edited images', 'Online gallery'] },
      { name: 'Basic', price: Math.round(basePrice * 0.4), includes: ['2 hours coverage', 'Edited images', 'Online gallery'] },
    ];
    const pricing: Record<string, number> = {};
    multiPackages.forEach(p => { pricing[p.name] = p.price; });

    const id = randomUUID();
    const shareToken = randomUUID().replace(/-/g, '');
    run(
      `INSERT INTO proposals (id, user_id, client_id, title, packages, pricing, contract_terms, share_token, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [id, userId, clientId, title,
       JSON.stringify(multiPackages), JSON.stringify(pricing),
       '1. 50% retainer non-refundable.\n2. 25% on shoot day.\n3. 25% before delivery.',
       shareToken]
    );

    return res.status(201).json({
      id, shareToken, title, generated: false,
      packages: multiPackages,
      pricing,
      contractTerms: '1. 50% retainer non-refundable.\n2. 25% on shoot day.\n3. 25% before delivery.',
    });
  }
});

export { router as proposalRoutes };
