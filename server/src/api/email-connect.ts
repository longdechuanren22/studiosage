import { Router, type Router as RouterType } from 'express';
import { randomUUID } from 'node:crypto';
import { initDb } from '../db/schema.js';
import { queryOne, run } from '../db/query.js';
import { detectProvider, testConnection, type EmailConfig } from '../adapters/email.js';
import { encrypt } from '../utils/crypto.js';

const router: RouterType = Router();

// Get current email config
router.get('/config', async (req, res) => {
  try {
    await initDb();
    const userId = req.userId!;
    const row = queryOne('SELECT * FROM tool_connections WHERE user_id = ? AND tool_id = ? AND status = ?', [userId, 'email_imap', 'active']);
    if (!row) {
      return res.json({ connected: false });
    }
    const cfg = JSON.parse((row as any).access_token_encrypted || '{}');
    res.json({
      connected: true,
      email: cfg.email,
      provider: cfg.email ? detectProvider(cfg.email).info : null,
      imapHost: cfg.imapHost,
      createdAt: (row as any).created_at,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Auto-detect provider info from email address
router.post('/detect', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: '请输入有效的邮箱地址' });
  }
  const { config, info } = detectProvider(email);
  res.json({ provider: info, imapHost: config.imapHost, imapPort: config.imapPort, smtpHost: config.smtpHost, smtpPort: config.smtpPort });
});

// Test email connection
router.post('/test', async (req, res) => {
  const { email, password, imapHost, imapPort, imapTls, smtpHost, smtpPort, smtpTls } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码/授权码不能为空' });
  }

  const { config } = detectProvider(email);
  const cfg: EmailConfig = {
    email,
    password,
    imapHost: imapHost || config.imapHost,
    imapPort: imapPort || config.imapPort,
    imapTls: imapTls !== undefined ? imapTls : config.imapTls,
    smtpHost: smtpHost || config.smtpHost,
    smtpPort: smtpPort || config.smtpPort,
    smtpTls: smtpTls !== undefined ? smtpTls : config.smtpTls,
  };

  try {
    await testConnection(cfg);
    res.json({ ok: true, message: '连接成功! 邮箱已就绪。' });
  } catch (err: any) {
    res.json({ ok: false, error: err.message || '连接失败，请检查邮箱地址和密码/授权码' });
  }
});

// Connect (try email login password, auto-detect if auth code needed)
router.post('/connect', async (req, res) => {
  const userId = req.userId!;
  const { email, password, imapHost, imapPort, imapTls, smtpHost, smtpPort, smtpTls } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '邮箱和密码不能为空' });
  }

  const { config } = detectProvider(email);
  const cfg: EmailConfig = {
    email,
    password,
    imapHost: imapHost || config.imapHost,
    imapPort: imapPort || config.imapPort,
    imapTls: imapTls !== undefined ? imapTls : config.imapTls,
    smtpHost: smtpHost || config.smtpHost,
    smtpPort: smtpPort || config.smtpPort,
    smtpTls: smtpTls !== undefined ? smtpTls : config.smtpTls,
  };

  const result = await testConnection(cfg);

  if (result.ok) {
    await initDb();
    run(
      `INSERT OR REPLACE INTO tool_connections (id, user_id, tool_id, access_token_encrypted, refresh_token_encrypted, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [randomUUID()!, userId, 'email_imap', JSON.stringify({email, imapHost: cfg.imapHost, imapPort: cfg.imapPort, smtpHost: cfg.smtpHost, smtpPort: cfg.smtpPort, imapTls: cfg.imapTls, smtpTls: cfg.smtpTls}), encrypt(password)]
    );

    try {
      const { startEmailWatcher } = await import('../workers/email-watcher.js');
      startEmailWatcher(cfg, 60000, userId).catch(err => console.error('EmailWatcher failed:', err));
    } catch (_) {}

    return res.json({ ok: true, message: '邮箱已连接! AI 正在监控你的收件箱。' });
  }

  if (result.authFailed) {
    return res.json({ ok: false, needsAuthCode: true, error: result.error });
  }

  return res.json({ ok: false, error: result.error });
});

// Disconnect email
router.post('/disconnect', async (req, res) => {
  try {
    await initDb();
    const userId = req.userId!;
    run('UPDATE tool_connections SET status = ? WHERE tool_id = ? AND user_id = ?', ['inactive', 'email_imap', userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export { router as emailConnectRoutes };
