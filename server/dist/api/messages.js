import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { initDb, saveDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';
import { classifyMessage } from '../ai/engine.js';
const router = Router();
const uuidv4 = () => uuid();
router.get('/inbox', async (_req, res) => {
    await initDb();
    const messages = queryAll(`
    SELECT m.*, c.name as client_name, c.stage as client_stage
    FROM messages m LEFT JOIN clients c ON m.client_id = c.id
    ORDER BY CASE m.category WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
    m.created_at DESC LIMIT 50
  `);
    res.json(messages);
});
router.post('/incoming', async (req, res) => {
    await initDb();
    const { from, subject, body, clientId } = req.body;
    const id = uuidv4();
    let clientContext;
    if (clientId) {
        clientContext = queryOne('SELECT * FROM clients WHERE id = ?', [clientId]);
    }
    const classification = await classifyMessage(body, subject || '', clientContext);
    run(`INSERT INTO messages (id, user_id, client_id, from_address, subject, body, category, status, ai_reply, stage_at_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, 'default', clientId || null, from || '', subject || '', body || '',
        classification.category, 'pending', classification.suggestedReply, classification.stage || null]);
    saveDb();
    res.json({ id, ...classification });
});
router.post('/:id/reply', async (req, res) => {
    await initDb();
    const { id } = req.params;
    const { customText } = req.body;
    if (customText) {
        run('UPDATE messages SET status = ?, ai_reply = ? WHERE id = ?', ['replied', customText, id]);
    }
    else {
        run('UPDATE messages SET status = ? WHERE id = ?', ['replied', id]);
    }
    saveDb();
    res.json({ status: 'sent' });
});
export { router as messageRoutes };
