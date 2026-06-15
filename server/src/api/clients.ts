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

// List all clients with summary stats
router.get('/', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const clients = queryAll(`
    SELECT c.*,
      (SELECT COUNT(*) FROM messages m WHERE m.client_id = c.id) as message_count,
      (SELECT COUNT(*) FROM messages m WHERE m.client_id = c.id AND m.status = 'pending') as pending_count,
      (SELECT COUNT(*) FROM invoices i WHERE i.client_id = c.id) as invoice_count,
      (SELECT COUNT(*) FROM invoices i WHERE i.client_id = c.id AND i.status = 'sent') as unpaid_invoice_count,
      (SELECT m.created_at FROM messages m WHERE m.client_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at,
      (SELECT subject FROM messages m WHERE m.client_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_subject
    FROM clients c
    WHERE c.user_id = ? AND c.status != 'archived'
    ORDER BY c.updated_at DESC
  `, [userId]);
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

  res.json({ ...(client as any), messages, invoices });
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

export { router as clientRoutes };
