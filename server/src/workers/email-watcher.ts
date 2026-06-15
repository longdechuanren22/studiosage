// Background worker: poll IMAP inbox → classify → auto-draft replies
import { randomUUID } from 'node:crypto';
import { fetchRecentMessages, type EmailConfig } from '../adapters/email.js';
import { classifyMessage } from '../ai/engine.js';
import { initDb } from '../db/schema.js';
import { queryOne, run } from '../db/query.js';
import { findOrCreateClient } from '../api/clients.js';

let running = false;
let lastUid: number | null = null; // Track highest seen UID to only fetch new messages

export async function startEmailWatcher(cfg: EmailConfig, intervalMs = 60000, userId?: string) {
  if (running) return;
  running = true;
  const uid = userId || 'default';
  console.log(`[EmailWatcher] Polling ${cfg.email} every ${intervalMs / 1000}s (user: ${uid})`);

  const poll = async () => {
    try {
      const safeLimit = Math.max(10, Math.floor(intervalMs / 10000)); // Scale with interval
      const messages = await fetchRecentMessages(cfg, safeLimit);
      await initDb();

      let newCount = 0;
      let spamCount = 0;

      for (const msg of messages) {
        if (!msg.id) continue;

        // Deduplicate by IMAP UID — stored in imap_uid column
        const existing = queryOne(
          'SELECT id FROM messages WHERE imap_uid = ? AND user_id = ?',
          [msg.id, uid]
        );
        if (existing) continue; // Already processed — skip

        const fromEmail = msg.from || '';
        const fromName = extractName(msg.from || '');

        // Only create client for non-spam messages
        const classification = await classifyMessage(msg.body || '', msg.subject || '');
        const isSpam = classification.category === 'spam';

        let client = null;
        if (!isSpam && fromEmail) {
          client = await findOrCreateClient(fromEmail, fromName, uid);
        }

        run(
          `INSERT INTO messages (id, user_id, client_id, from_address, subject, body, category, status, ai_reply, channel, imap_uid, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID()!, uid, client?.id || null,
            msg.from || '', msg.subject || '', msg.body || '',
            classification.category,
            isSpam ? 'archived' : 'pending',
            isSpam ? '' : classification.suggestedReply,
            'email',
            msg.id, // IMAP UID for dedup
            msg.date.toISOString(),
          ]
        );

        if (isSpam) {
          spamCount++;
        } else {
          newCount++;
          if (client) {
            run(
              "UPDATE clients SET stage = ?, updated_at = datetime('now') WHERE id = ? AND stage = 'inquiry'",
              ['engaged', client.id]
            );
          }
        }
      }

      if (newCount > 0 || spamCount > 0) {
        console.log(`[EmailWatcher] ${newCount} new, ${spamCount} spam filtered`);
      }

      // Track last seen UID
      const maxUid = Math.max(...messages.map(m => parseInt(m.id) || 0));
      if (maxUid > (lastUid || 0)) lastUid = maxUid;

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
