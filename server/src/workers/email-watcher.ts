// Background worker: poll IMAP inbox → classify → auto-draft replies
// Fixes: sender reputation, better spam detection, name extraction from body, type auto-detect
import { randomUUID } from 'node:crypto';
import { fetchRecentMessages, type EmailConfig } from '../adapters/email.js';
import { classifyMessage } from '../ai/engine.js';
import { extractEntities } from '../ai/rules-engine.js';
import { initDb } from '../db/schema.js';
import { queryOne, queryAll, run } from '../db/query.js';
import { findOrCreateClient } from '../api/clients.js';
import { notifyMessage, notifyClientUpdated } from '../utils/events.js';

let running = false;
let polling = false;

export async function startEmailWatcher(cfg: EmailConfig, intervalMs = 60000, userId?: string) {
  if (running) {
    console.log('[EmailWatcher] Already running, skipping duplicate start');
    return;
  }
  running = true;
  console.log(`[EmailWatcher] STARTED v2 with spam detection — ${new Date().toISOString()}`);
  const uid = userId || 'default';
  console.log(`[EmailWatcher] Polling ${cfg.email} every ${intervalMs / 1000}s (user: ${uid})`);

  const poll = async () => {
    if (polling) return; // Prevent concurrent polls
    polling = true;
    try {
      const safeLimit = Math.max(10, Math.floor(intervalMs / 10000));
      const messages = await fetchRecentMessages(cfg, safeLimit);
      await initDb();

      // Load known senders (existing client emails) for reputation check
      const knownSenders = new Set(
        (queryAll('SELECT email FROM clients WHERE user_id = ? AND email IS NOT NULL AND email != ?', [uid, '']) as any[])
          .map((r: any) => r.email?.toLowerCase())
          .filter(Boolean)
      );

      let newCount = 0, spamCount = 0;

      for (const msg of messages) {
        if (!msg.id) continue;

        const existing = queryOne('SELECT id FROM messages WHERE imap_uid = ? AND user_id = ?', [msg.id, uid]);
        if (existing) continue;

        const fromEmail = extractEmail(msg.from || '');
        const fromName = extractName(msg.from || '');
        const bodyName = extractNameFromBody(msg.body || '');

        // Reputation: known client vs unknown sender
        const isKnownSender: boolean = !!fromEmail && knownSenders.has(fromEmail.toLowerCase());

        // Classify the message
        const classification = await classifyMessage(msg.body || '', msg.subject || '', {
          isKnownSender,
          fromEmail: fromEmail || undefined,
        } as any);

        // Simple, reliable spam detection:
        // 1. Platform domain (LinkedIn, Steam, Tencent...) → always spam
        // 2. Automated sender address (noreply, notifications...) → always spam
        // 3. AI classified as spam → spam
        const isPlatformSpam = !!fromEmail && isPlatformDomain(fromEmail);
        const isAutoSender = !!fromEmail && isAutomatedSender(fromEmail);
        const isSpam = classification.category === 'spam' || isPlatformSpam || isAutoSender;

        console.log(`[EmailWatcher] ${isSpam ? 'SPAM' : 'OK  '} platform=${isPlatformSpam} auto=${isAutoSender} | ${msg.subject?.slice(0, 45)} | ${(fromEmail || '').slice(0, 35)}`);

        // Determine best name: body signature > email header > email username
        const bestName = bodyName || fromName;

        let client = null;
        if (!isSpam && fromEmail) {
          client = await findOrCreateClient(fromEmail, bestName, uid);

          // Auto-detect service type from message content
          if (client && !isSpam) {
            const detectedType = detectServiceType(msg.subject || '', msg.body || '');
            const existing = queryOne('SELECT type FROM clients WHERE id = ? AND type = ?', [client.id, '']) as any;
            if (detectedType && existing) {
              // Only set type if it was previously empty (first detection)
              run('UPDATE clients SET type = ?, updated_at = datetime(\'now\') WHERE id = ? AND type = ?',
                [detectedType, client.id, '']);
            }
          }
        }

        const msgId = randomUUID()!;
        const replyText = isSpam ? '' : classification.suggestedReply;

        run(
          `INSERT INTO messages (id, user_id, client_id, from_address, subject, body, category, status, ai_reply, channel, imap_uid, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [msgId, uid, client?.id || null, msg.from || '', msg.subject || '', msg.body || '',
           classification.category, isSpam ? 'archived' : 'pending',
           replyText, 'email', msg.id, msg.date.toISOString()]
        );

        if (isSpam) { spamCount++; }
        else {
          newCount++;
          if (client) {
            run("UPDATE clients SET stage = ?, updated_at = datetime('now') WHERE id = ? AND stage = 'inquiry'",
              ['engaged', client.id]);
            if (bestName && bestName !== client.name && bestName.includes(' ')) {
              run("UPDATE clients SET name = ?, updated_at = datetime('now') WHERE id = ? AND (name = ? OR name LIKE '%@%')",
                [bestName, client.id, client.name]);
            }
            // Push real-time event
            notifyClientUpdated(uid, client.id, 'engaged');
          }
          // Push real-time event
          notifyMessage(uid, {
            id: msgId, from_address: msg.from, subject: msg.subject,
            client_id: client?.id || null, category: classification.category, status: isSpam ? 'archived' : 'pending',
          });

          // ── Extract key entities from message ──
          const entities = extractEntities(msg.body || '', msg.subject || '');
          for (const entity of entities) {
            run(
              `INSERT INTO client_insights (id, user_id, client_id, message_id, type, value, raw_text)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [randomUUID()!, uid, client?.id || null, msgId, entity.type, entity.value, entity.raw]
            );
          }
          if (entities.length > 0) {
            console.log(`[EmailWatcher] Extracted ${entities.length} entities: ${entities.map(e => e.type + '=' + e.value.slice(0, 30)).join(', ')}`);
          }

          // ── Auto-send AI reply via SMTP ──
          if (replyText) {
            try {
              const { sendReply } = await import('../adapters/email.js');
              await sendReply(cfg, msg.from || '', msg.subject || '', replyText);
              run("UPDATE messages SET status = 'replied' WHERE id = ?", [msgId]);
              console.log(`[EmailWatcher] Auto-replied: ${(msg.from || '').slice(0, 40)}`);
            } catch (err) {
              console.error(`[EmailWatcher] Auto-send failed (draft saved): ${(err as Error).message}`);
            }
          }
        }
      }

      if (newCount > 0 || spamCount > 0) {
        console.log(`[EmailWatcher] ${newCount} new, ${spamCount} spam`);
      }
    } catch (err) {
      console.error('[EmailWatcher] Poll failed, will retry:', (err as Error).message);
    } finally {
      polling = false;
    }
  };

  await poll();
  const timer = setInterval(poll, intervalMs);

  // Keep Node process alive (unref would let process exit)
  timer.unref?.();
}

// Extract email address from "Name <email>" format
function extractEmail(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1].trim().toLowerCase() : from.trim().toLowerCase();
}

// Extract display name from "Name <email>" format
function extractName(from: string): string {
  const m = from.match(/^"?([^"<]+)"?\s*</);
  if (m) {
    const name = m[1].trim();
    // Filter out email-like names (when From is just "user@domain.com")
    if (name.includes('@')) return '';
    return name;
  }
  return '';
}

// Try to extract a real name from email body (signature lines)
function extractNameFromBody(body: string): string {
  if (!body) return '';
  // Look for common signature patterns
  const patterns = [
    /(?:^|\n)(?:Best|Cheers|Thanks|Sincerely|Regards|Warmly)[,\s]*\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/m,
    /(?:^|\n)--\s*\n\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/m,
    /(?:^|\n)(?:Sent from|Get Outlook|Typed on).*\n?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})?/m,
  ];
  for (const pat of patterns) {
    const m = body.match(pat);
    if (m && m[1]) {
      const name = m[1].trim();
      // Validate: should look like a real name (2-3 words, each capitalized)
      if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,2}$/.test(name)) return name;
    }
  }
  return '';
}

// Detect service type from message content
function detectServiceType(subject: string, body: string): string | null {
  const text = (subject + ' ' + body.slice(0, 1000)).toLowerCase();
  if (/wedding|bride|groom|bridal|marriage|ceremony|reception/i.test(text)) return 'wedding';
  if (/portrait|headshot|family photo|maternity|newborn|senior photo/i.test(text)) return 'portrait';
  if (/event|party|birthday|corporate event|gala|conference/i.test(text)) return 'event';
  if (/commercial|product|real estate|food|fashion|catalog/i.test(text)) return 'commercial';
  return null;
}

// ── Language-agnostic spam detection ──
// Strategy: domain reputation + email structure > content keywords

// Known platform/notification domains — never photography clients
export const PLATFORM_DOMAINS = [
  // Social / professional
  'linkedin.com', 'facebook.com', 'facebookmail.com', 'instagram.com',
  'twitter.com', 'tiktok.com', 'snapchat.com', 'pinterest.com',
  // E-commerce / marketing
  'amazon.com', 'aliexpress.com', 'ebay.com', 'etsy.com',
  'nike.com', 'adidas.com', 'steampowered.com', 'epicgames.com',
  // Streaming / media
  'netflix.com', 'spotify.com', 'youtube.com', 'twitch.tv',
  'tencent.com', 'iqiyi.com', 'youku.com', 'bilibili.com',
  // Payment / finance
  'paypal.com', 'stripe.com', 'square.com', 'venmo.com',
  // Travel / booking
  'airbnb.com', 'booking.com', 'expedia.com', 'trip.com',
  'uber.com', 'lyft.com', 'doordash.com',
  // Newsletter platforms
  'mailchimp', 'sendgrid', 'constantcontact', 'convertkit',
  'substack.com', 'medium.com', 'ghost.io',
  // Job platforms
  'indeed.com', 'monster.com', 'glassdoor.com', 'ziprecruiter.com',
  // Domain & hosting
  'godaddy.com', 'namecheap.com', 'wix.com', 'squarespace.com',
  'horoscopofree.com', 'newsletter.',
];

// Email addresses that are always automated
const AUTOMATED_SENDERS = [
  /^noreply@/i, /^no-reply@/i, /^donotreply@/i, /^mailer-daemon@/i,
  /^bounce/i, /^postmaster@/i, /^notifications?@/i, /^messages-noreply@/i,
  /^jobs-listings@/i, /^invitations@/i, /^newsletter@/i, /^marketing@/i,
  /^promo@/i, /^deals@/i, /^offers@/i, /^sales@/i, /^info@/i,
  /^admin@/i, /^support@/i, /^service@/i, /^hello@/i, /^team@/i,
];

function isPlatformDomain(email: string): boolean {
  return PLATFORM_DOMAINS.some(d => email.toLowerCase().includes(d));
}

function isAutomatedSender(email: string): boolean {
  return AUTOMATED_SENDERS.some(p => p.test(email));
}

