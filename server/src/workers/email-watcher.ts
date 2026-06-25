// Background worker: IMAP inbox → AI classify → extract entities → SSE push
// Uses polling (interval-based). For IDLE mode, upgrade the `imap` library first.

import { randomUUID } from 'node:crypto';
import { fetchRecentMessages, type EmailConfig } from '../adapters/email.js';
import { classifyMessage, isBusinessEmail, extractEnhancedEntities } from '../ai/engine.js';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';
import { notifyMessage, notifyClientUpdated } from '../utils/events.js';

let interval: ReturnType<typeof setInterval> | null = null;
let deadlineInterval: ReturnType<typeof setInterval> | null = null;
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

          // 🔒 非业务邮件过滤 — 社交媒体通知/银行账单/广告等直接跳过
          const bizCheck = isBusinessEmail(msg.subject || '', cleanBody, fromEmail);
          if (!bizCheck.isBusiness) {
            if (bizCheck.reason !== 'no photography-related content detected') {
              // Only log filtered non-business emails, not personal emails without photo context
            }
            continue;
          }

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

          // ── 更新客户对话记忆（上限10次交互）──
          if (clientId) {
            const now = new Date().toISOString();
            const prevMemory = typeof conversationMemory === 'object' && conversationMemory ? conversationMemory : {};
            const prevSubjects = Array.isArray(prevMemory.recentSubjects) ? prevMemory.recentSubjects : [];
            const prevTopics = Array.isArray(prevMemory.recentTopics) ? prevMemory.recentTopics : [];
            const currentSubject = msg.subject || '';
            const memory = {
              lastInteractionAt: now,
              messageCount: Math.min((prevMemory.messageCount || 0) + 1, 10),
              recentSubjects: [currentSubject, ...prevSubjects.filter((s: string) => s !== currentSubject)].slice(0, 10),
              recentTopics: prevTopics.slice(0, 10),
              lastSentiment: sentiment,
              lastPricingIntent: pricingIntent,
              lastReplyAt: prevMemory.lastReplyAt,
              pendingSince: prevMemory.pendingSince,
            };
            // Size guard: limit JSON to ~5KB
            const memStr = JSON.stringify(memory);
            if (memStr.length > 5000) {
              memory.recentSubjects = memory.recentSubjects.slice(0, 5);
              memory.recentTopics = memory.recentTopics.slice(0, 5);
            }
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

          // ── 增强实体提取 → 服化道/风格/档期 → 客户面板 ──
          try {
            const entities = extractEnhancedEntities(msg.subject || '', cleanBody);
            if (entities.length > 0 && clientId) {
              const client = queryOne('SELECT * FROM clients WHERE id = ?', [clientId]) as any;
              const meta = JSON.parse(client?.metadata || '{}');

              // 初始化 insights 数组
              if (!meta.insights) meta.insights = [];

              for (const entity of entities) {
                switch (entity.type) {
                  case 'date':
                    if (!client?.shoot_date) {
                      run("UPDATE clients SET shoot_date=?, updated_at=datetime('now') WHERE id=?", [entity.value, clientId]);
                      meta.insights.push({ type: 'date', value: entity.value, extractedAt: new Date().toISOString() });
                    }
                    break;
                  case 'clothing':
                  case 'makeup':
                  case 'props':
                    // 服化道 → 存储到 insights
                    if (!meta[entity.type]) {
                      meta[entity.type] = entity.value;
                      meta.insights.push({ type: entity.type, value: entity.value, extractedAt: new Date().toISOString() });
                    }
                    break;
                  case 'style':
                    if (!meta.style) {
                      meta.style = entity.value;
                      meta.insights.push({ type: 'style', value: entity.value, extractedAt: new Date().toISOString() });
                    }
                    break;
                  case 'venue':
                    if (!meta.location) {
                      meta.location = entity.value;
                      meta.insights.push({ type: 'venue', value: entity.value, extractedAt: new Date().toISOString() });
                    }
                    break;
                  case 'timeline':
                    if (!meta.timeline) {
                      meta.timeline = entity.value;
                      meta.insights.push({ type: 'timeline', value: entity.value, extractedAt: new Date().toISOString() });
                    }
                    break;
                  case 'guest_count':
                    if (!meta.guest_count) {
                      meta.guest_count = entity.value;
                      meta.insights.push({ type: 'guest_count', value: entity.value, extractedAt: new Date().toISOString() });
                    }
                    break;
                  default:
                    if (!meta[entity.type]) {
                      meta[entity.type] = entity.value;
                    }
                }
              }

              // 自动检测拍摄类型
              if (!client?.type) {
                const { detectShootType } = await import('../ai/rules-engine.js');
                const detectedType = detectShootType(cleanBody.toLowerCase());
                if (detectedType) {
                  run("UPDATE clients SET type=?, updated_at=datetime('now') WHERE id=?", [detectedType, clientId]);
                  meta.insights.push({ type: 'shoot_type', value: detectedType, extractedAt: new Date().toISOString() });
                }
              }

              // 按 type 去重 + 上限 50 条，保留最新的
              const seen = new Set<string>();
              meta.insights = meta.insights
                .sort((a: any, b: any) => new Date(b.extractedAt || 0).getTime() - new Date(a.extractedAt || 0).getTime())
                .filter((insight: any) => {
                  const key = `${insight.type}:${insight.value}`;
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                })
                .slice(0, 50);
              run("UPDATE clients SET metadata=?, updated_at=datetime('now') WHERE id=?", [JSON.stringify(meta), clientId]);

              if (entities.length > 0) console.log('[EmailWatcher] 📊 Extracted', entities.length, 'entities → client profile for', fromEmail);
            }
          } catch (err) {
            console.warn('[EmailWatcher] Entity extraction failed:', (err as Error).message);
          }

          // ── 邮件↔修片联动：检测活跃项目 → 智能标签 ──
          let linkedProjectId: string | null = null;
          if (clientId) {
            const activeProject = queryOne(
              `SELECT id, title, status FROM projects
               WHERE client_id = ? AND user_id = ? AND status NOT IN ('completed','cancelled')
               ORDER BY updated_at DESC LIMIT 1`,
              [clientId, uid]
            ) as any;
            if (activeProject) {
              linkedProjectId = activeProject.id;
              // 检测邮件是否涉及当前项目的修片/选片
              const photoKeywords = /photo|picture|image|gallery|选片|修图|精修|交付|样片|download|review|edit|retouch/i;
              if (photoKeywords.test(cleanBody + (msg.subject || ''))) {
                // 自动补充项目上下文到 AI 回复
                if (!aiReply.includes('project') && !aiReply.includes('项目')) {
                  aiReply = aiReply + ` (关于您的${activeProject.title}项目，当前状态：${activeProject.status})`;
                }
              }
            }
          }

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
              linkedProjectId,
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

  // ⏰ 截止日检查器 — 每5分钟扫描一次，自动发送提醒
  const deadlineCheck = async () => {
    try {
      const { checkDeadlines } = await import('../utils/notifications.js');
      const { sendReply } = await import('../adapters/email.js');
      const { decrypt } = await import('../utils/crypto.js');
      const { queryOne, run } = await import('../db/query.js');
      const jobs = await checkDeadlines();
      for (const job of jobs) {
        // 获取任意一个已连接的邮箱来发送
        const conn = queryOne("SELECT * FROM tool_connections WHERE user_id = ? AND tool_id = 'email_imap' AND status = 'active' LIMIT 1", [uid]);
        if (!conn) continue;
        const cfgData = conn as any;
        const cfg = JSON.parse(cfgData.access_token_encrypted || '{}');
        const password = cfgData.refresh_token_encrypted ? decrypt(cfgData.refresh_token_encrypted) : '';
        try {
          await sendReply({ ...cfg, password }, job.clientEmail, job.subject, job.body);
          console.log(`[Notification] ✅ Auto-sent: ${job.type} → ${job.clientEmail}`);
        } catch (err) {
          console.warn(`[Notification] Failed to send ${job.type}:`, (err as Error).message);
        }
      }
      if (jobs.length > 0) console.log(`[Notification] 📬 Auto-sent ${jobs.length} deadline reminder(s)`);
    } catch (err) {
      // Deadline check is non-critical
    }
  };
  deadlineInterval = setInterval(deadlineCheck, 300000); // Every 5 minutes
  deadlineCheck(); // Run immediately on start

  console.log(`[EmailWatcher] ✅ Polling started — ${intervalMs}ms + deadline checker (5min)`);
}

export function stopEmailWatcher(): void {
  running = false;
  if (interval) { clearInterval(interval); interval = null; }
  if (deadlineInterval) { clearInterval(deadlineInterval); deadlineInterval = null; }
  console.log('[EmailWatcher] Stopped (including deadline checker)');
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
