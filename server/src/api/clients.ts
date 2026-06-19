import { Router, type Router as RouterType } from 'express';
import { v4 as uuid } from 'uuid';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';

const router: RouterType = Router();
const uuidv4 = () => uuid();

/** Get the default user ID (for background workers or legacy) */
export function getDefaultUserId(): string {
  const user = queryOne("SELECT id FROM users WHERE email = 'default@local'") as any;
  return user?.id || 'default';
}

// List all clients with summary stats (supports ?search= keyword)
router.get('/', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const search = (req.query.search as string || '').trim();

  let whereClause = "WHERE c.user_id = ? AND c.status != 'archived'";
  const params: any[] = [userId];

  if (search) {
    whereClause += " AND (c.name LIKE ? OR c.email LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const clients = queryAll(`
    SELECT c.*,
      (SELECT COUNT(*) FROM messages m WHERE m.client_id = c.id) as message_count,
      (SELECT COUNT(*) FROM messages m WHERE m.client_id = c.id AND m.status = 'pending') as pending_count,
      (SELECT COUNT(*) FROM invoices i WHERE i.client_id = c.id) as invoice_count,
      (SELECT COUNT(*) FROM invoices i WHERE i.client_id = c.id AND i.status = 'sent') as unpaid_invoice_count,
      (SELECT m.created_at FROM messages m WHERE m.client_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at,
      (SELECT subject FROM messages m WHERE m.client_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_subject
    FROM clients c
    ${whereClause}
    ORDER BY c.updated_at DESC
  `, params);
  res.json(clients);
});

// Get single client with all messages + invoices
router.get('/:id', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const client = queryOne('SELECT * FROM clients WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!client) return res.status(404).json({ ok: false, error: 'Client not found' });

  const messages = queryAll(
    'SELECT * FROM messages WHERE client_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.params.id]
  );
  const invoices = queryAll(
    'SELECT * FROM invoices WHERE client_id = ? ORDER BY created_at DESC',
    [req.params.id]
  );

  // Parse AI-extracted insights from metadata
  const c = client as any;
  let insights: any[] = [];
  try {
    const meta = JSON.parse(c.metadata || '{}');
    insights = meta.insights || [];
    c.metadata_parsed = { ...meta, insights: undefined }; // return cleaned metadata without raw insights array
  } catch { c.metadata_parsed = {}; }

  res.json({ ...c, messages, invoices, insights });
});

// Create client manually
router.post('/', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { name, email, phone, wechat_id, type, notes } = req.body;
  if (!name) return res.status(400).json({ ok: false, error: 'Client name is required' });

  const id = uuidv4();
  run(
    `INSERT INTO clients (id, user_id, name, email, phone, wechat_id, type, notes, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, name, email || '', phone || '', wechat_id || '', type || '', notes || '', 'manual']
  );
  res.json({ id, name, email, phone, wechat_id, type, notes, source: 'manual' });
});

// Update client
router.patch('/:id', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { name, email, phone, wechat_id, type, notes, stage } = req.body;
  const existing = queryOne('SELECT * FROM clients WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!existing) return res.status(404).json({ ok: false, error: 'Client not found' });

  run(
    `UPDATE clients SET name=?, email=?, phone=?, wechat_id=?, type=?, notes=?, stage=?, updated_at=datetime('now') WHERE id=? AND user_id=?`,
    [name || (existing as any).name, email ?? (existing as any).email, phone ?? (existing as any).phone,
     wechat_id ?? (existing as any).wechat_id, type ?? (existing as any).type,
     notes ?? (existing as any).notes, stage ?? (existing as any).stage, req.params.id, userId]
  );
  res.json({ ok: true });
});

// Archive client
router.delete('/:id', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  run("UPDATE clients SET status = 'archived', updated_at = datetime('now') WHERE id = ? AND user_id = ?", [req.params.id, userId]);
  res.json({ ok: true });
});

// Find or create client by email (used by email watcher)
export async function findOrCreateClient(email: string, name?: string, userId?: string): Promise<{ id: string; name: string }> {
  await initDb();
  const uid = userId || getDefaultUserId();
  const existing = queryOne('SELECT id, name FROM clients WHERE email = ? AND user_id = ?', [email, uid]);
  if (existing) {
    if (name && !(existing as any).name) {
      run("UPDATE clients SET name = ?, updated_at = datetime('now') WHERE id = ?", [name, (existing as any).id]);
    }
    return existing as any;
  }

  const id = uuidv4();
  const displayName = name || email.split('@')[0];
  run(
    `INSERT INTO clients (id, user_id, name, email, source, stage)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, uid, displayName, email, 'email', 'inquiry']
  );
  return { id, name: displayName };
}

// Client timeline — aggregated events (messages + proposals + invoices)
router.get('/:id/timeline', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const client = queryOne('SELECT id FROM clients WHERE id = ? AND user_id = ?', [req.params.id, userId]);
  if (!client) return res.status(404).json({ ok: false, error: 'Client not found' });

  const messages = queryAll(
    `SELECT 'message' as type, id, subject as title, status, created_at FROM messages WHERE client_id = ? AND user_id = ? AND category != 'spam' ORDER BY created_at DESC LIMIT 20`,
    [req.params.id, userId]
  );
  const invoices = queryAll(
    `SELECT 'invoice' as type, id, description as title, status, amount, created_at FROM invoices WHERE client_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 10`,
    [req.params.id, userId]
  );

  // Get projects for this client
  const projects = queryAll(
    `SELECT 'project' as type, id, title, status, created_at FROM projects WHERE client_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 10`,
    [req.params.id, userId]
  );

  // Merge and sort by created_at DESC
  const timeline = [...(messages as any[]), ...(projects as any[]), ...(invoices as any[])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 30);

  res.json({ ok: true, timeline });
});

// Import clients from CSV
router.post('/import', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { rows } = req.body; // Array of {name, email, phone, type, notes}
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ ok: false, error: 'No data provided' });

  let created = 0;
  for (const row of rows) {
    if (!row.name && !row.email) continue;
    const id = uuidv4();
    const existing = row.email ? queryOne('SELECT id FROM clients WHERE email = ? AND user_id = ?', [row.email, userId]) : null;
    if (existing) continue; // Skip duplicates

    run(`INSERT INTO clients (id, user_id, name, email, phone, type, notes, source, stage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, row.name || '', row.email || '', row.phone || '', row.type || '', row.notes || '', 'import', 'inquiry']);
    created++;
  }
  res.json({ ok: true, created, total: rows.length });
});

// Export clients as CSV
router.get('/export/csv', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const clients = queryAll(
    `SELECT name, email, phone, wechat_id, type, stage, source, status, notes, created_at
     FROM clients WHERE user_id = ? AND status != 'archived' ORDER BY name`,
    [userId]
  ) as any[];

  const header = 'Name,Email,Phone,WeChat,Type,Stage,Source,Status,Notes,Created\n';
  const rows = clients.map(c =>
    `"${(c.name || '').replace(/"/g, '""')}","${(c.email || '').replace(/"/g, '""')}","${(c.phone || '').replace(/"/g, '""')}","${(c.wechat_id || '').replace(/"/g, '""')}","${c.type || ''}","${c.stage || ''}","${c.source || ''}","${c.status || ''}","${(c.notes || '').replace(/"/g, '""')}","${c.created_at || ''}"`
  ).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="studiosage-clients.csv"');
  res.send('﻿' + header + rows); // BOM for Excel UTF-8
});

export { router as clientRoutes };
