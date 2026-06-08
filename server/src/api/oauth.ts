import { Router, type Router as RouterType } from 'express';

const router: RouterType = Router();

// OAuth initiation endpoints — redirect to provider
router.get('/google', (_req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return res.status(500).json({ error: 'Google OAuth not configured' });

  const redirectUri = `${process.env.APP_URL || 'http://localhost:3001'}/api/oauth/google/callback`;
  const scope = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar';
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

    res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding-top:80px;">
        <h2>✅ Google connected!</h2>
        <p>You can close this window and return to StudioSage.</p>
        <script>window.close()</script>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send('OAuth failed. Please try again.');
  }
});

export { router as oauthRoutes };
