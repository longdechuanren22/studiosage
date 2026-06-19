// Background worker: IMAP inbox → AI classify → extract entities → SSE push
// Uses polling (interval-based). For IDLE mode, upgrade the `imap` library first.

import { randomUUID } from 'node:crypto';
import { fetchRecentMessages, type EmailConfig } from '../adapters/email.js';
import { classifyMessage } from '../ai/engine.js';
import { initDb } from '../db/schema.js';
import { queryOne, run } from '../db/query.js';
import { notifyMessage, notifyClientUpdated } from '../utils/events.js';

let interval: ReturnType<typeof setInterval> | null = null;
let running = false;

export async function startEmailWatcher(cfg: EmailConfig, intervalMs = 15000, userId?: string) {
  if (running) {
    console.log('[EmailWatcher] Already running, skipping duplicate start');
    return;
  }
  running = true;
  const uid = userId || 'default';
  console.log(`[EmailWatcher] Polling started for ${cfg.email} every ${intervalMs}ms (user: ${uid})`);

  await initDb();

  const runOnce = async () => {
    try {
      const messages = await fetchRecentMessages(cfg, 5);
      if (!messages.length) return;

      for (const msg of messages) {
        try {
          if (!msg.id) continue;

          // Deduplicate
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
          } catch (err) {
            console.warn('[EmailWatcher] AI classification failed:', (err as Error).message);
          }

          // 🔒 Skip spam
          if (category === 'spam') {
            console.log('[EmailWatcher] 🗑️ Spam filtered:', msg.subject);
            continue;
          }

          // Auto-promote inquiry → engaged
          if (clientStage === 'inquiry' && clientId) {
            run("UPDATE clients SET stage='engaged', updated_at=datetime('now') WHERE id=?", [clientId]);
            try { notifyClientUpdated(uid, clientId, 'engaged'); } catch {}
          }

          // ── AI entity extraction → auto-fill client profile ──
          try {
            const { extractEntities } = await import('../ai/rules-engine.js');
            const entities = extractEntities(cleanBody, msg.subject || '');
            if (entities.length > 0 && clientId) {
              const client = queryOne('SELECT * FROM clients WHERE id = ?', [clientId]) as any;
              for (const entity of entities) {
                switch (entity.type) {
                  case 'date':
                    if (!client?.shoot_date && entity.value)
                      run("UPDATE clients SET shoot_date=?, updated_at=datetime('now') WHERE id=?", [entity.value, clientId]);
                    break;
                  case 'budget':
                    // 🔒 安全：budget 提取不准，不自动归档
                    break;
                  case 'location':
                  case 'guest_count':
                  case 'hours':
                  case 'requirement': {
                    const meta = JSON.parse(client?.metadata || '{}');
                    if (!meta[entity.type]) {
                      meta[entity.type] = entity.value;
                      run("UPDATE clients SET metadata=?, updated_at=datetime('now') WHERE id=?", [JSON.stringify(meta), clientId]);
                    }
                    break;
                  }
                }
                if (entity.type === 'requirement' && client && !client.type) {
                  const { detectShootType } = await import('../ai/rules-engine.js');
                  const detectedType = detectShootType(cleanBody.toLowerCase());
                  if (detectedType)
                    run("UPDATE clients SET type=?, updated_at=datetime('now') WHERE id=?", [detectedType, clientId]);
                }
              }
              if (entities.length > 0) console.log('[EmailWatcher] 📊 Extracted', entities.length, 'entities for client', fromEmail);
            }
          } catch {}

          // Store message
          const msgId = randomUUID();
          run(
            `INSERT INTO messages (id, user_id, client_id, from_address, subject, body, category, ai_reply, status, channel, stage_at_time, imap_uid, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'email', ?, ?, datetime('now'))`,
            [msgId, uid, clientId, msg.from || '', msg.subject || '', cleanBody.slice(0, 5000),
             category, aiReply.slice(0, 2000), 'pending', clientStage, msg.id]
          );

          // SSE real-time push
          try {
            notifyMessage(uid, { id: msgId, from_address: msg.from, subject: msg.subject, client_id: clientId, category, status: 'pending' });
            notifyClientUpdated(uid, clientId!, 'engaged');
          } catch {}

          console.log(`[EmailWatcher] ⚡ ${fromEmail} → ${category} → Dashboard`);
        } catch (err) {
          console.error('[EmailWatcher] Error:', msg.id, (err as Error).message);
        }
      }
    } catch (err) {
      console.error('[EmailWatcher] Poll cycle error:', (err as Error).message);
    }
  };

  // Initial run
  runOnce();
  interval = setInterval(runOnce, intervalMs);
  console.log(`[EmailWatcher] ✅ Polling started — ${intervalMs}ms interval`);
}

export function stopEmailWatcher(): void {
  running = false;
  if (interval) { clearInterval(interval); interval = null; }
  console.log('[EmailWatcher] Stopped');
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
