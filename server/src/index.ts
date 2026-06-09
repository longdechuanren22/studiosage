import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initDb } from './db/schema.js';
import { messageRoutes } from './api/messages.js';
import { invoiceRoutes } from './api/invoices.js';
import { dashboardRoutes } from './api/dashboard.js';
import { settingsRoutes } from './api/settings.js';
import { webhookRoutes } from './api/webhooks.js';
import { oauthRoutes } from './api/oauth.js';
import { healthRoutes } from './api/health.js';
import { demoRoutes } from './api/demo.js';
import { deployRoutes } from './api/deploy.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { securityHeaders, apiLimiter } from './middleware/security.js';
import { startInboxWatcher } from './workers/inbox-watcher.js';

const app = express();
const PORT = process.env.PORT || 3001;

initDb().catch(err => { console.error('DB init failed:', err); process.exit(1); });

app.use(securityHeaders as any);
app.use(apiLimiter);
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/messages', messageRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/deploy', deployRoutes);

// Serve client build in production
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res, next) => { try { res.sendFile(path.join(clientDist, 'index.html')); } catch { next(); } });
}

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`StudioSage API running on http://localhost:${PORT}`);
  if (process.env.GOOGLE_ACCESS_TOKEN) {
    startInboxWatcher(60000).catch(err => console.error('InboxWatcher failed:', err));
  }
});
