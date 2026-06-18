// Background worker: poll IMAP inbox → AI classify → draft reply (human approves before send)
import { randomUUID } from 'node:crypto';
import { fetchRecentMessages, sendReply, type EmailConfig } from '../adapters/email.js';
import { classifyMessage } from '../ai/engine.js';
import { initDb } from '../db/schema.js';
import { queryOne, run } from '../db/query.js';
import { notifyMessage, notifyClientUpdated } from '../utils/events.js';

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
        let clientStage = 'inquiry';
        if (fromEmail) {
          const client = queryOne('SELECT id, stage FROM clients WHERE user_id = ? AND email = ?', [uid, fromEmail]) as any;
          if (client) {
            clientId = client.id;
            clientStage = client.stage || 'inquiry';
            run("UPDATE clients SET updated_at=datetime('now') WHERE id=?", [client.id]);
          } else {
            clientId = randomUUID();
            run(
              "INSERT INTO clients (id, user_id, email, name, stage, source, updated_at) VALUES (?, ?, ?, ?, 'inquiry', 'email', datetime('now'))",
              [clientId, uid, fromEmail, extractName(msg.from || '')]
            );
          }
        }

        // ── AI classification + draft reply ──
        let category = 'normal';
        let aiReply = '';
        try {
          const result = await classifyMessage(
            cleanBody.slice(0, 2000),
            msg.subject || '',
            { name: extractName(msg.from || ''), stage: clientStage }
          );
          category = result.category;
          aiReply = result.suggestedReply || '';
          // Auto-promote inquiry → engaged on first real message
          if (clientStage === 'inquiry' && category !== 'spam' && clientId) {
            run("UPDATE clients SET stage='engaged', updated_at=datetime('now') WHERE id=?", [clientId]);
            try { notifyClientUpdated(uid, clientId, 'engaged'); } catch {}
          }
        } catch {
          // AI unavailable → just store as normal
        }

        const msgId = randomUUID();
        run(
          `INSERT INTO messages (id, user_id, client_id, from_address, subject, body, category, ai_reply, status, channel, stage_at_time, imap_uid, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'email', ?, ?, datetime('now'))`,
          [msgId, uid, clientId, msg.from || '', msg.subject || '', cleanBody.slice(0, 5000),
           category, aiReply.slice(0, 2000), clientStage, msg.id]
        );

        // SSE push to Dashboard
        try {
          notifyMessage(uid, { id: msgId, from_address: msg.from, subject: msg.subject, client_id: clientId, category, status: 'pending' });
        } catch {}

        newCount++;
      }
      if (newCount > 0) console.log(`[EmailWatcher] ${newCount} new messages → AI classified + drafted replies`);
    } catch (err) {
      console.error('[EmailWatcher] Poll error:', (err as Error).message);
    } finally {
      polling = false;
    }
  };

  poll();
  setInterval(poll, intervalMs);
  console.log('[EmailWatcher] Started (AI classify + draft, human-approved send)');
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
