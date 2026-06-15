import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Note: uncaughtException handler is set in db/schema.ts (handles DB flush)

// Load .env from project root
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
import { oauthRoutes } from './api/oauth.js';
import { healthRoutes } from './api/health.js';
import { demoRoutes } from './api/demo.js';
import { deployRoutes } from './api/deploy.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { securityHeaders, apiLimiter } from './middleware/security.js';
import { emailConnectRoutes } from './api/email-connect.js';
import { proposalRoutes, proposalPublicRoutes } from './api/proposals.js';
import { portalRoutes } from './api/portal.js';
import { calendarRoutes } from './api/calendar.js';
import { logger } from './utils/logger.js';

const app = express();
const PORT = process.env.PORT || 3001;

initDb().catch(err => { logger.error('DB init failed:', err); process.exit(1); });

// Auto-start email watcher if config exists in DB — disabled for now
// async function tryStartEmailWatcher() { ... }
// tryStartEmailWatcher();

app.use(securityHeaders as any);
app.use(apiLimiter);
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

// ── Public routes (no auth required) ──
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/deploy', deployRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/proposals', proposalPublicRoutes);  // shared/:token — public
app.use('/api/portal', portalRoutes);              // client portal — token-based

// ── Protected routes (JWT required) ──
app.use('/api/messages', authenticate, messageRoutes);
app.use('/api/invoices', authenticate, invoiceRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/settings', authenticate, settingsRoutes);
app.use('/api/clients', authenticate, clientRoutes);
app.use('/api/email', authenticate, emailConnectRoutes);
app.use('/api/proposals', authenticate, proposalRoutes);
app.use('/api/calendar', authenticate, calendarRoutes);

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
  logger.info(`StudioSage API running on http://localhost:${PORT}`);
});
