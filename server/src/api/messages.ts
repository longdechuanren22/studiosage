import { Router, type Router as RouterType } from 'express';
import { v4 as uuid } from 'uuid';
import { initDb } from '../db/schema.js';
import { queryAll, queryOne, run } from '../db/query.js';
import { classifyMessage } from '../ai/engine.js';
import { sendReply } from '../adapters/email.js';
import { decrypt } from '../utils/crypto.js';

const router: RouterType = Router();
const uuidv4 = () => uuid();

// Get inbox messages from DB (populated by email-watcher)
router.get('/inbox', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const messages = queryAll(`
    SELECT m.*, c.name as client_name, c.stage as client_stage
    FROM messages m LEFT JOIN clients c ON m.client_id = c.id
    WHERE m.user_id = ? AND m.status != 'archived' AND m.category != 'spam'
    ORDER BY CASE m.category WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
    m.created_at DESC LIMIT 50
  `, [userId]);
  res.json(messages);
});

// Get dashboard stats
router.get('/stats', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const newCount = (queryOne('SELECT COUNT(*) as c FROM messages WHERE user_id = ? AND status = ?', [userId, 'pending']) as any)?.c || 0;
  const repliedCount = (queryOne('SELECT COUNT(*) as c FROM messages WHERE user_id = ? AND status = ?', [userId, 'replied']) as any)?.c || 0;
  const urgentCount = (queryOne('SELECT COUNT(*) as c FROM messages WHERE user_id = ? AND category = ? AND status = ?', [userId, 'urgent', 'pending']) as any)?.c || 0;
  const totalCount = (queryOne('SELECT COUNT(*) as c FROM messages WHERE user_id = ?', [userId]) as any)?.c || 0;
  res.json({ newMessages: newCount, repliedCount, urgentCount, totalCount });
});

// Incoming message — used by email watcher AND as a public API
router.post('/incoming', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { from, subject, body, clientId } = req.body;
  const id = uuidv4();

  let clientContext: any;
  if (clientId) {
    clientContext = queryOne('SELECT * FROM clients WHERE id = ? AND user_id = ?', [clientId, userId]);
  }

  const classification = await classifyMessage(body, subject || '', clientContext);

  // Spam check: apply the same conservative scoring as the email watcher
  const fromEmail = (from || '').match(/<([^>]+)>/)?.[1] || from || '';
  const isKnownClient = !!clientId && !!queryOne('SELECT id FROM clients WHERE id = ?', [clientId]);
  const spamScore = calcIncomingSpamScore(subject || '', body || '', isKnownClient, fromEmail);
  const isSpam = classification.category === 'spam' || spamScore >= 3;

  run(`INSERT INTO messages (id, user_id, client_id, from_address, subject, body, category, status, ai_reply, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, clientId || null, from || '', subject || '', body || '',
     classification.category, isSpam ? 'archived' : 'pending',
     isSpam ? '' : classification.suggestedReply, new Date().toISOString()]);

  res.json({ id, ...classification, isSpam, spamScore });
});

// Update AI reply (user edits the draft)
router.patch('/:id/reply', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { id } = req.params;
  const { ai_reply } = req.body;
  run('UPDATE messages SET ai_reply = ? WHERE id = ? AND user_id = ?', [ai_reply || '', id, userId]);
  res.json({ ok: true });
});

// Send reply via real SMTP
router.post('/:id/send', async (req, res) => {
  await initDb();
  const userId = req.userId!;
  const { id } = req.params;
  const { customText } = req.body;

  const msg = queryOne('SELECT * FROM messages WHERE id = ? AND user_id = ?', [id, userId]);
  if (!msg) return res.status(404).json({ error: '消息不存在' });

  const msgData = msg as any;

  // Get email config from DB
  const conn = queryOne("SELECT * FROM tool_connections WHERE user_id = ? AND tool_id = 'email_imap' AND status = 'active'", [userId]);
  if (!conn) return res.status(400).json({ error: '邮箱未连接，请先连接邮箱' });

  const connData = conn as any;
  const cfg = JSON.parse(connData.access_token_encrypted || '{}');
  const password = connData.refresh_token_encrypted ? decrypt(connData.refresh_token_encrypted) : '';

  const replyText = customText || msgData.ai_reply || '';
  const subject = msgData.subject || '';

  try {
    await sendReply({ ...cfg, password }, msgData.from_address, subject, replyText);
    run('UPDATE messages SET status = ?, ai_reply = ? WHERE id = ? AND user_id = ?', ['replied', replyText, id, userId]);
    // Update client timestamp so dashboard reflects recent activity
    if (msgData.client_id) {
      run("UPDATE clients SET updated_at = datetime('now') WHERE id = ?", [msgData.client_id]);
    }
    res.json({ status: 'sent' });
  } catch (err: any) {
    res.status(500).json({ error: `Send failed: ${err.message}` });
  }
});

// Shared spam scoring (mirrors email-watcher logic for the API endpoint)
const PLATFORM_DOMAINS = [
  'linkedin.com', 'facebook.com', 'facebookmail.com', 'instagram.com', 'twitter.com',
  'tiktok.com', 'snapchat.com', 'pinterest.com', 'amazon.com', 'aliexpress.com',
  'ebay.com', 'etsy.com', 'nike.com', 'adidas.com', 'steampowered.com', 'epicgames.com',
  'netflix.com', 'spotify.com', 'youtube.com', 'twitch.tv', 'tencent.com',
  'iqiyi.com', 'youku.com', 'bilibili.com', 'paypal.com', 'stripe.com',
  'airbnb.com', 'booking.com', 'expedia.com', 'uber.com', 'lyft.com',
  'mailchimp', 'sendgrid', 'constantcontact', 'substack.com', 'medium.com',
  'indeed.com', 'monster.com', 'glassdoor.com', 'godaddy.com', 'wix.com',
];
const AUTO_SENDERS = /^(noreply|no-reply|donotreply|mailer-daemon|bounce|postmaster|notifications?|messages-noreply|jobs-listings|invitations|newsletter|marketing|promo|deals|offers|sales)@/i;

function calcIncomingSpamScore(subject: string, body: string, isKnownClient: boolean, fromEmail: string): number {
  const text = (subject + ' ' + body.slice(0, 1000)).toLowerCase();
  let score = 0;
  if (fromEmail && PLATFORM_DOMAINS.some(d => fromEmail.toLowerCase().includes(d))) score += 2;
  if (fromEmail && AUTO_SENDERS.test(fromEmail)) score += 1;
  if (body && /^\s*(<html|<head|<body|<div|<meta)/i.test(body.trim())) score += 1;
  if (/(unsubscribe|opt.out|email preferences|view (in|online) browser)/i.test(text)) score += 1;
  if (/(sale|discount|promo|clearance|flash|limited|exclusive|deal|offer|shop|buy).*(off|code|ends|save|up to)/i.test(subject)) score += 1;
  if (isKnownClient) score -= 2;
  if (/\?/.test(text)) score -= 1;
  if (/^(hi|hey|hello|dear)\b/im.test(text)) score -= 1;
  return Math.max(0, score);
}

export { router as messageRoutes };
