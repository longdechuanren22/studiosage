import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.env') });
import { initDb } from './db/schema.js';
import { authenticate } from './middleware/auth.js';
import { authRoutes } from './api/auth.js';
import { messageRoutes } from './api/messages.js';
import { invoiceRoutes } from './api/invoices.js';
import { dashboardRoutes } from './api/dashboard.js';
import { settingsRoutes } from './api/settings.js';
import { clientRoutes } from './api/clients.js';
import { webhookRoutes } from './api/webhooks.js';
import { healthRoutes } from './api/health.js';
import { demoRoutes } from './api/demo.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { securityHeaders, apiLimiter, authLimiter } from './middleware/security.js';
import { emailConnectRoutes } from './api/email-connect.js';
import { portalRoutes } from './api/portal.js';
import { projectRoutes } from './api/projects.js';
import { galleryDeliveryRoutes } from './api/gallery-delivery.js';
import { billingRoutes } from './api/billing.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3001;

initDb().catch(err => { logger.error('DB init failed:', err); process.exit(1); });

// Trust reverse proxy for accurate client IPs (rate limiting, logging)
app.set('trust proxy', 1);

// Auto-start email watcher if config exists in DB
async function tryStartEmailWatcher() {
  try {
    const { initDb } = await import('./db/schema.js');
    const { queryAll } = await import('./db/query.js');
    await initDb();
    const connections = queryAll("SELECT * FROM tool_connections WHERE tool_id = 'email_imap' AND status = 'active'") as any[];
    for (const conn of connections) {
      const cfg = JSON.parse(conn.access_token_encrypted || '{}');
      const { decrypt } = await import('./utils/crypto.js');
      const password = conn.refresh_token_encrypted ? decrypt(conn.refresh_token_encrypted) : '';
      if (cfg.email) {
        const { startEmailWatcher } = await import('./workers/email-watcher.js');
        startEmailWatcher({ ...cfg, password }, 0, conn.user_id); // 0=IDLE mode (real-time, no polling)
        logger.info(`Auto-started real-time email watcher (IMAP IDLE) for ${cfg.email}`);
      }
    }
  } catch (err) {
    logger.warn('Could not auto-start email watcher:', (err as Error).message);
  }
}
setTimeout(tryStartEmailWatcher, 2000);

app.use(securityHeaders as any);
app.use(apiLimiter);
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

// ── Static file serving for uploaded photos ──
const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ── Public routes (no auth required) ──
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/portal', portalRoutes);  // client portal — 选片/审核/消息/发票

// ── Protected routes (JWT required) ──
app.use('/api/messages', authenticate, messageRoutes);
app.use('/api/invoices', authenticate, invoiceRoutes);
// SSE stream — token via query param
app.get('/api/dashboard/stream', async (req, res) => {
  const token = req.query.token as string;
  if (!token) { res.status(401).json({ error: 'Missing token' }); return; }
  try {
    const { verifyToken } = await import('./middleware/auth.js');
    const payload = verifyToken(token);
    const { subscribe } = await import('./utils/events.js');
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    subscribe(payload.userId, res);
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/api/clients', authenticate, clientRoutes);
app.use('/api/email', authenticate, emailConnectRoutes);
app.use('/api/projects', authenticate, projectRoutes);
app.use('/api/projects', authenticate, galleryDeliveryRoutes);
app.use('/api/billing', billingRoutes);

// Serve client build in production
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use('/sage', express.static(clientDist));
  app.get('/sage/*', (_req, res) => { res.sendFile(path.join(clientDist, 'index.html')); });
  app.get('/', (_req, res) => { res.redirect('/sage/'); });
}

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`StudioSage API running on http://localhost:${PORT}`);
});

// Graceful shutdown — close IMAP IDLE connections
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down email watchers');
  try {
    const { stopEmailWatcher } = await import('./workers/email-watcher.js');
    stopEmailWatcher();
  } catch {}
  process.exit(0);
});
process.on('SIGINT', async () => {
  logger.info('SIGINT received — shutting down email watchers');
  try {
    const { stopEmailWatcher } = await import('./workers/email-watcher.js');
    stopEmailWatcher();
  } catch {}
  process.exit(0);
});
