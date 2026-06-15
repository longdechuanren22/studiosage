// Background worker: poll IMAP inbox → classify → auto-draft replies
import { randomUUID } from 'node:crypto';
import { fetchRecentMessages, type EmailConfig } from '../adapters/email.js';
import { classifyMessage } from '../ai/engine.js';
import { initDb } from '../db/schema.js';
import { queryOne, run } from '../db/query.js';
import { findOrCreateClient } from '../api/clients.js';

let running = false;

export async function startEmailWatcher(cfg: EmailConfig, intervalMs = 60000, userId?: string) {
  if (running) return;
  running = true;
  const uid = userId || 'default';
  console.log(`[EmailWatcher] Polling ${cfg.email} every ${intervalMs / 1000}s (user: ${uid})`);

  const poll = async () => {
    try {
      const messages = await fetchRecentMessages(cfg, 5);
      await initDb();

      for (const msg of messages) {
        if (!msg.id) continue;
        const existing = queryOne('SELECT id FROM messages WHERE id = ?', [msg.id]);
        if (existing) continue;

        const fromEmail = msg.from || '';
        const fromName = extractName(msg.from || '');
        const client = fromEmail ? await findOrCreateClient(fromEmail, fromName, uid) : null;

        const classification = await classifyMessage(msg.body || '', msg.subject || '');

        run(`INSERT INTO messages (id, user_id, client_id, from_address, subject, body, category, status, ai_reply, channel, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID()!, uid, client?.id || null, msg.from || '', msg.subject || '', msg.body || '',
           classification.category, 'pending', classification.suggestedReply, 'email', msg.date.toISOString()]);

        if (client) {
          run("UPDATE clients SET stage = ?, updated_at = datetime('now') WHERE id = ? AND stage = 'inquiry'",
            ['engaged', client.id]);
        }
      }
    } catch (err) {
      console.error('[EmailWatcher]', (err as Error).message);
    }
  };

  await poll();
  setInterval(poll, intervalMs);
}

function extractName(from: string): string {
  const m = from.match(/^"?([^"<]+)"?\s*</);
  return m ? m[1].trim() : '';
}
