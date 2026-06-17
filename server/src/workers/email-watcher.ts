// Background worker: poll IMAP inbox → store messages (passive only, no auto-reply)
import { randomUUID } from 'node:crypto';
import { fetchRecentMessages, type EmailConfig } from '../adapters/email.js';
import { initDb } from '../db/schema.js';
import { queryOne, run } from '../db/query.js';

let running = false;
let polling = false;

export async function startEmailWatcher(cfg: EmailConfig, intervalMs = 60000, userId?: string) {
  if (running) {
    console.log('[EmailWatcher] Already running, skipping duplicate start');
    return;
  }
  running = true;
  const uid = userId || 'default';
  console.log(`[EmailWatcher] Polling ${cfg.email} every ${intervalMs / 1000}s (user: ${uid})`);

  const poll = async () => {
    if (polling) return;
    polling = true;
    try {
      const messages = await fetchRecentMessages(cfg, 10);
      await initDb();

      let newCount = 0;
      for (const msg of messages) {
        if (!msg.id) continue;
        const existing = queryOne('SELECT id FROM messages WHERE imap_uid = ? AND user_id = ?', [msg.id, uid]);
        if (existing) continue;

        const fromEmail = extractEmail(msg.from || '');
        const cleanBody = stripHtml(msg.body || '');

        // Find or create client
        let clientId: string | null = null;
        if (fromEmail) {
          const client = queryOne('SELECT id FROM clients WHERE user_id = ? AND email = ?', [uid, fromEmail]) as any;
          if (client) {
            clientId = client.id;
            run("UPDATE clients SET updated_at=datetime('now') WHERE id=?", [client.id]);
          } else {
            clientId = randomUUID();
            run(
              "INSERT INTO clients (id, user_id, email, name, stage, source, updated_at) VALUES (?, ?, ?, ?, 'inquiry', 'email', datetime('now'))",
              [clientId, uid, fromEmail, extractName(msg.from || '')]
            );
          }
        }

        run(
          `INSERT INTO messages (id, user_id, client_id, from_address, subject, body, category, status, channel, stage_at_time, imap_uid, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'normal', 'pending', 'email', 'inquiry', ?, datetime('now'))`,
          [randomUUID(), uid, clientId, msg.from || '', msg.subject || '', cleanBody.slice(0, 5000), msg.id]
        );
        newCount++;
      }
      if (newCount > 0) console.log(`[EmailWatcher] ${newCount} new messages for ${cfg.email}`);
    } catch (err) {
      console.error('[EmailWatcher] Poll error:', (err as Error).message);
    } finally {
      polling = false;
    }
  };

  poll(); // Initial poll
  setInterval(poll, intervalMs);
  console.log('[EmailWatcher] Started (passive mode)');
}

function extractEmail(from: string): string {
  const m = from.match(/<(.+?)>/);
  return m ? m[1].toLowerCase().trim() : from.toLowerCase().trim();
}

function extractName(from: string): string {
  const m = from.match(/^"?([^"<]+)"?\s*</);
  return m ? m[1].trim() : from.split('@')[0] || '';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isEmailWatcherRunning(): boolean { return running; }
