// Background worker: IMAP IDLE real-time inbox → AI classify → extract entities → SSE push
// Replaces polling with persistent IMAP IDLE connection — new mail triggers processing instantly.

import { randomUUID } from 'node:crypto';
import { startIdleWatcher, stopIdleWatcher, type OnNewMessage, type EmailConfig } from '../adapters/email.js';
import { classifyMessage } from '../ai/engine.js';
import { initDb } from '../db/schema.js';
import { queryOne, run } from '../db/query.js';
import { notifyMessage, notifyClientUpdated } from '../utils/events.js';

let running = false;

export async function startEmailWatcher(cfg: EmailConfig, _intervalMs = 0, userId?: string) {
  if (running) {
    console.log('[EmailWatcher] Already running, skipping duplicate start');
    return;
  }
  running = true;
  const uid = userId || 'default';
  console.log(`[EmailWatcher] IMAP IDLE mode active for ${cfg.email} (user: ${uid})`);

  await initDb();

  const processMessage: OnNewMessage = async (msg) => {
    try {
      if (!msg.id) return;

      // Deduplicate
      const existing = queryOne('SELECT id FROM messages WHERE imap_uid = ? AND user_id = ?', [msg.id, uid]);
      if (existing) return;

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

      // 🔒 Skip spam entirely — don't store, don't notify
      if (category === 'spam') {
        console.log('[EmailWatcher] 🗑️ Spam filtered:', msg.subject);
        return;
      }

      // Auto-promote inquiry → engaged on first real message
      if (clientStage === 'inquiry' && clientId) {
        run("UPDATE clients SET stage='engaged', updated_at=datetime('now') WHERE id=?", [clientId]);
        try { notifyClientUpdated(uid, clientId, 'engaged'); } catch {}
      }

      // ── AI 实体提取 → 自动补全客户档案 ──
      try {
        const { extractEntities } = await import('../ai/rules-engine.js');
        const entities = extractEntities(cleanBody, msg.subject || '');
        if (entities.length > 0 && clientId) {
          const client = queryOne('SELECT * FROM clients WHERE id = ?', [clientId]) as any;
          for (const entity of entities) {
            switch (entity.type) {
              case 'date':
                if (!client?.shoot_date && entity.value) {
                  run("UPDATE clients SET shoot_date=?, updated_at=datetime('now') WHERE id=?", [entity.value, clientId]);
                }
                break;
              case 'budget':
                if (!client?.metadata || !JSON.parse(client.metadata || '{}').budget) {
                  const meta = JSON.parse(client?.metadata || '{}');
                  meta.budget = entity.value;
                  run("UPDATE clients SET metadata=?, updated_at=datetime('now') WHERE id=?", [JSON.stringify(meta), clientId]);
                }
                break;
              case 'location':
                if (!client?.metadata || !JSON.parse(client.metadata || '{}').location) {
                  const meta = JSON.parse(client?.metadata || '{}');
                  meta.location = entity.value;
                  run("UPDATE clients SET metadata=?, updated_at=datetime('now') WHERE id=?", [JSON.stringify(meta), clientId]);
                }
                break;
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
            // Auto-detect shoot type
            if (entity.type === 'requirement' && client && !client.type) {
              const { detectShootType } = await import('../ai/rules-engine.js');
              const detectedType = detectShootType(cleanBody.toLowerCase());
              if (detectedType) {
                run("UPDATE clients SET type=?, updated_at=datetime('now') WHERE id=?", [detectedType, clientId]);
              }
            }
          }
          if (entities.length > 0) console.log('[EmailWatcher] 📊 Extracted', entities.length, 'entities for client', fromEmail);
        }
      } catch (err) {
        // Entity extraction is non-critical
      }

      // Store message
      const msgId = randomUUID();
      const msgStatus = 'pending';
      run(
        `INSERT INTO messages (id, user_id, client_id, from_address, subject, body, category, ai_reply, status, channel, stage_at_time, imap_uid, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'email', ?, ?, datetime('now'))`,
        [msgId, uid, clientId, msg.from || '', msg.subject || '', cleanBody.slice(0, 5000),
         category, aiReply.slice(0, 2000), msgStatus, clientStage, msg.id]
      );

      // 🔴 SSE real-time push to Dashboard
      try {
        notifyMessage(uid, {
          id: msgId, from_address: msg.from, subject: msg.subject,
          client_id: clientId, category, status: msgStatus,
        });
        notifyClientUpdated(uid, clientId!, 'engaged');
      } catch {}

      console.log(`[EmailWatcher] ⚡ Real-time: new message from ${fromEmail} → ${category} → Dashboard pushed`);
    } catch (err) {
      console.error('[EmailWatcher] Error processing message:', msg.id, (err as Error).message);
    }
  };

  startIdleWatcher(cfg, processMessage);
  console.log('[EmailWatcher] ✅ Real-time IMAP IDLE started — no polling, instant push');
}

export function stopEmailWatcher(): void {
  running = false;
  stopIdleWatcher();
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
