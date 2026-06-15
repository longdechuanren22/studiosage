import { Router, type Router as RouterType } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { initDb } from '../db/schema.js';
import { run } from '../db/query.js';

const router: RouterType = Router();
const ENV_PATH = path.join(process.cwd(), '..', '.env');

function writeEnvVar(key: string, value: string) {
  if (!fs.existsSync(ENV_PATH)) return;
  let content = fs.readFileSync(ENV_PATH, 'utf-8');
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  fs.writeFileSync(ENV_PATH, content);
  process.env[key] = value;
}

// OAuth initiation endpoints
router.get('/google', (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'Google OAuth not configured' });

  const redirectUri = `${process.env.APP_URL || 'http://localhost:3001'}/api/oauth/google/callback`;
  const scope = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/calendar';
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

  res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'No auth code' });

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.APP_URL || 'http://localhost:3001'}/api/oauth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: String(code), client_id: clientId!, client_secret: clientSecret!, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const tokens = await tokenRes.json() as any;

    if (tokens.error) {
      console.error('[OAuth] Token error:', tokens);
      return res.status(500).send(`OAuth failed: ${tokens.error_description || tokens.error}`);
    }

    // Save tokens to .env so they survive restarts
    writeEnvVar('GOOGLE_ACCESS_TOKEN', tokens.access_token);
    if (tokens.refresh_token) {
      writeEnvVar('GOOGLE_REFRESH_TOKEN', tokens.refresh_token);
    }

    // Save to database
    try {
      await initDb();
      run(
        `INSERT OR REPLACE INTO tool_connections (id, user_id, tool_id, access_token_encrypted, refresh_token_encrypted, expires_at, status)
         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
        [randomUUID()!, 'default', 'google', tokens.access_token, tokens.refresh_token || '', null]
      );
    } catch (dbErr) {
      console.error('[OAuth] DB save error:', dbErr);
    }

    // Start inbox watcher now
    try {
      const { startInboxWatcher } = await import('../workers/inbox-watcher.js');
      startInboxWatcher(60000).catch(err => console.error('InboxWatcher failed:', err));
    } catch (_) { /* watcher optional */ }

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding-top:80px;background:#f5f5f7;">
        <div style="font-size:48px;margin-bottom:16px;">✅</div>
        <h2 style="color:#1d1d1f;">Gmail 已连接!</h2>
        <p style="color:#86868b;">AI 正在监控你的收件箱，自动分类+起草回复。</p>
        <p style="color:#a1a1a6;font-size:13px;">可以关闭此窗口，回到 StudioSage。</p>
        <script>setTimeout(function(){window.close()},2000)</script>
      </body></html>
    `);
  } catch (err: any) {
    console.error('[OAuth] Callback error:', err);
    res.status(500).send(`OAuth failed: ${err.message}`);
  }
});

export { router as oauthRoutes };
