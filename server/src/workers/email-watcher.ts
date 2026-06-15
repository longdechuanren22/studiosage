// Background worker: poll IMAP inbox → classify → auto-draft replies
// Fixes: sender reputation, better spam detection, name extraction from body, type auto-detect
import { randomUUID } from 'node:crypto';
import { fetchRecentMessages, type EmailConfig } from '../adapters/email.js';
import { classifyMessage } from '../ai/engine.js';
import { initDb } from '../db/schema.js';
import { queryOne, queryAll, run } from '../db/query.js';
import { findOrCreateClient } from '../api/clients.js';

let running = false;

export async function startEmailWatcher(cfg: EmailConfig, intervalMs = 60000, userId?: string) {
  if (running) return;
  running = true;
  const uid = userId || 'default';
  console.log(`[EmailWatcher] Polling ${cfg.email} every ${intervalMs / 1000}s (user: ${uid})`);

  const poll = async () => {
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

        // Spam detection: only mark as spam if MULTIPLE strong signals
        // Principle: false negatives (spam in inbox) > false positives (real client hidden)
        const spamScore = calcSpamScore(msg.subject || '', msg.body || '', isKnownSender);
        const isSpam = classification.category === 'spam' || spamScore >= 3;

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

        run(
          `INSERT INTO messages (id, user_id, client_id, from_address, subject, body, category, status, ai_reply, channel, imap_uid, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID()!, uid, client?.id || null, msg.from || '', msg.subject || '', msg.body || '',
           classification.category, isSpam ? 'archived' : 'pending',
           isSpam ? '' : classification.suggestedReply, 'email', msg.id, msg.date.toISOString()]
        );

        if (isSpam) { spamCount++; }
        else {
          newCount++;
          if (client) {
            // Update client stage from inquiry → engaged on first real message
            run("UPDATE clients SET stage = ?, updated_at = datetime('now') WHERE id = ? AND stage = 'inquiry'",
              ['engaged', client.id]);

            // Update client name if we found a better one from email body
            if (bestName && bestName !== client.name && bestName.includes(' ')) {
              run("UPDATE clients SET name = ?, updated_at = datetime('now') WHERE id = ? AND (name = ? OR name LIKE '%@%')",
                [bestName, client.id, client.name]);
            }
          }
        }
      }

      if (newCount > 0 || spamCount > 0) {
        console.log(`[EmailWatcher] ${newCount} new, ${spamCount} spam`);
      }
    } catch (err) {
      console.error('[EmailWatcher]', (err as Error).message);
    }
  };

  await poll();
  setInterval(poll, intervalMs);
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

// Conservative spam scoring: only mark as spam if multiple strong signals
// Returns 0-5, threshold >= 3 = spam
function calcSpamScore(subject: string, body: string, isKnownSender: boolean): number {
  const text = (subject + ' ' + body.slice(0, 1000)).toLowerCase();
  let score = 0;

  // Strong spam signals (each adds 1 point)
  const strongSpam = [
    /unsubscribe|opt.out|email preferences|update your subscription/i,
    /\b(SEO|backlink|guest post|sponsor)\b/i,
    /(buy|purchase).*(followers|likes|traffic|views)/i,
    /congratulations.*(winner|won|selected|chosen)/i,
    /earn.*(money|cash|income|dollar).*(home|online)/i,
    /limited.time.offer|act.now|don't miss out|exclusive deal/i,
    /casino|gambling|poker|betting|lottery|jackpot/i,
    /adult|xxx|porn|escort|dating site/i,
    /pharmacy|viagra|cialis|weight loss pill|diet pill/i,
    /work.from.home.*(earn|income|salary)/i,
    /loan.*approv|credit.*repair|debt.*(relief|consolidat)/i,
    /invoice.*(attachment|attached|overdue|unpaid).*scam/i,
    /verify.*(account|identity|payment).*click/i,
    /security.*(alert|breach|compromis).*verify/i,
    /nigerian|prince|inheritance|western union|money transfer/i,
  ];
  for (const p of strongSpam) { if (p.test(text)) score += 1; }

  // Bulk/marketing signals (each adds 0.5, rounded up)
  const bulkSignals = [
    /view (in|online|as webpage|in browser)/i,
    /(weekly|monthly|daily).*(newsletter|digest|roundup)/i,
    /(webinar|free ebook|whitepaper|case study)/i,
    /(sale|discount|promo|clearance).*(off|code|ends)/i,
    /(shipping|tracking|package|delivery).*(update|confirm|notification)/i,
    /(order|receipt|purchase).*(confirm|#|number)/i,
    /(facebook|instagram|linkedin|twitter|tiktok|snapchat|pinterest).*(notif|mention|follow)/i,
    /(cloud|drive|storage).*(full|upgrade|limit)/i,
  ];
  let bulkCount = bulkSignals.filter(p => p.test(text)).length;
  score += Math.ceil(bulkCount * 0.5);

  // From known sender → -2 points (unlikely to be spam)
  if (isKnownSender) score -= 2;

  // Looks like a real person writing → -1 point
  const humanSignals = [
    /\?/, // Has a question
    /^(hi|hey|hello|dear|good morning|good afternoon)\b/im, // Greeting
    /(thanks|thank you|appreciate|best regards|cheers)/i, // Polite closing
    /^(my name is|I am|I'm|we are|we're)\b/im, // Self-introduction
    /(looking for|interested in|do you|could you|would you|can you|wondering if)/i, // Inquiry language
  ];
  if (humanSignals.some(p => p.test(text))) score -= 1;

  return Math.max(0, score);
}
