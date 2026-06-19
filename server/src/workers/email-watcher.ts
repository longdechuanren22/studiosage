// Background worker: IMAP inbox → AI classify → extract entities → SSE push
// Uses polling (interval-based). For IDLE mode, upgrade the `imap` library first.

import { randomUUID } from 'node:crypto';
import { fetchRecentMessages, type EmailConfig } from '../adapters/email.js';
import { classifyMessage } from '../ai/engine.js';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';
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

          // ── AI 多轮对话记忆 —— 构建上下文 ──
          let conversationMemory = undefined;
          if (clientId) {
            const history = queryAll(
              `SELECT subject, body, category, created_at FROM messages
               WHERE client_id = ? AND user_id = ? AND category != 'spam'
               ORDER BY created_at DESC LIMIT 5`,
              [clientId, uid]
            ) as any[];
            const recentSubjects = history.map((h: any) => h.subject).filter(Boolean);
            const recentTopics = history.map((h: any) => {
              const s = (h.subject + ' ' + (h.body || '').slice(0, 200)).toLowerCase();
              const topics = [];
              if (/wedding|婚礼/i.test(s)) topics.push('wedding');
              if (/portrait|写真|人像/i.test(s)) topics.push('portrait');
              if (/price|budget|价格|多少钱|报价/i.test(s)) topics.push('pricing');
              if (/date|日期|when|schedule/i.test(s)) topics.push('scheduling');
              if (/gallery|选片|photo|照片/i.test(s)) topics.push('photos');
              return topics.length ? topics.join(',') : '';
            }).filter(t => t !== '');

            const lastPhotoReply = queryOne(
              "SELECT created_at FROM messages WHERE client_id=? AND user_id=? AND channel='email' AND status='replied' ORDER BY created_at DESC LIMIT 1",
              [clientId, uid]
            ) as any;
            const lastClientMsg = queryOne(
              "SELECT created_at FROM messages WHERE client_id=? AND user_id=? AND channel='email' ORDER BY created_at DESC LIMIT 1",
              [clientId, uid]
            ) as any;
            const pendingSince = (!lastPhotoReply || (lastClientMsg && lastClientMsg.created_at > lastPhotoReply.created_at))
              ? lastClientMsg?.created_at : undefined;

            conversationMemory = {
              messageCount: history.length,
              recentSubjects,
              recentTopics,
              lastReplyAt: lastPhotoReply?.created_at,
              pendingSince,
            };
          }

          // ── AI classification + sentiment + pricing intent ──
          let category = 'normal';
          let aiReply = '';
          let sentiment = 'neutral' as string;
          let pricingIntent = false;
          let needsImmediateAttention = false;
          try {
            const result = await classifyMessage(
              cleanBody.slice(0, 3000),
              msg.subject || '',
              {
                name: extractName(msg.from || ''),
                stage: clientStage,
                conversationMemory,
              }
            );
            category = result.category;
            aiReply = result.suggestedReply || '';
            sentiment = result.sentiment || 'neutral';
            pricingIntent = result.pricingIntent || false;
            needsImmediateAttention = result.needsImmediateAttention || false;
          } catch (err) {
            console.warn('[EmailWatcher] AI classification failed:', (err as Error).message);
          }

          // ── 更新客户对话记忆 ──
          if (clientId) {
            const now = new Date().toISOString();
            const memory = {
              lastInteractionAt: now,
              messageCount: (conversationMemory?.messageCount || 0) + 1,
              lastSubject: msg.subject || '',
              lastSentiment: sentiment,
              lastPricingIntent: pricingIntent,
            };
            run("UPDATE clients SET conversation_memory=?, updated_at=datetime('now') WHERE id=?",
              [JSON.stringify(memory), clientId]);
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

          // Build subject with AI tags
          let taggedSubject = msg.subject || '';
          const tags: string[] = [];
          if (pricingIntent) tags.push('💰询价');
          if (needsImmediateAttention || sentiment === 'urgent' || sentiment === 'frustrated') tags.push('🔴');
          if (sentiment === 'anxious') tags.push('🟡');
          if (tags.length) taggedSubject = tags.join('') + ' ' + taggedSubject;

          // Store message
          const msgId = randomUUID();
          run(
            `INSERT INTO messages (id, user_id, client_id, from_address, subject, body, category, ai_reply, status, channel, stage_at_time, imap_uid, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'email', ?, ?, datetime('now'))`,
            [msgId, uid, clientId, msg.from || '', taggedSubject, cleanBody.slice(0, 5000),
             category, aiReply.slice(0, 2000), 'pending', clientStage, msg.id]
          );

          // SSE real-time push with sentiment data
          try {
            notifyMessage(uid, {
              id: msgId, from_address: msg.from, subject: taggedSubject,
              client_id: clientId, category, status: 'pending',
              sentiment, pricingIntent, needsImmediateAttention,
            });
            notifyClientUpdated(uid, clientId!, 'engaged');
          } catch {}

          if (needsImmediateAttention) {
            console.log(`[EmailWatcher] ⚠️ IMMEDIATE: ${fromEmail} — sentiment=${sentiment} pricing=${pricingIntent}`);
          }

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
