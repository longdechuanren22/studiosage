# StudioSage

## Project Identity

- **Product**: Photo selection → retouching workflow → delivery tool for global independent photographers
- **Stack**: Express 5 + SQLite (better-sqlite3) + React 18 + TypeScript 5.6 + Vite 5
- **Deployment**: Docker on HK UCloud server (123.58.212.114), Nginx reverse proxy
- **Domain**: hzlmagent.com
- **Pricing**: Free (1 project/500 photos) / Pro $19/mo / Pro Annual $180/yr

## Architecture

```
server/src/
  api/          Express route handlers (auth, billing, clients, dashboard, demo, email-connect, gallery-delivery, health, invoices, messages, portal, projects, settings, webhooks)
  ai/           AI engine (Claude/DeepSeek) + offline rules engine
  adapters/     email (IMAP/SMTP) + stripe
  db/           schema.ts (SQLite migrations) + query.ts (sync helpers)
  middleware/    auth, clientAuth, paywall, security, validate
  utils/        crypto, events (SSE), logger, pagination, pdf, storage (R2)
  workers/      email-watcher (IMAP poll → AI classify → draft reply)
client/src/
  pages/        Dashboard, Clients, Projects, Invoices, Settings, Connect, Onboarding, Landing, Login, Register, ForgotPassword, Terms, Privacy, PortalSelection, PortalReview
  components/   Layout, AuthGuard, ErrorBoundary, Skeleton, ConnectButtons
  contexts/     UserContext, ToastContext
  utils/        api.ts, platform.ts (Tauri desktop detection), tauri.d.ts
  i18n.tsx      EN/ZH translations
```

## Key Design Rules

1. **SQLite is synchronous** — all `queryAll/queryOne/run` calls are sync, no `await` needed
2. **All JSON fields stored as TEXT** — parse with `JSON.parse(field || '[]')` on read
3. **Status machines**: projects (draft→selection→editing→review→completed), galleries (uploading→awaiting→selection_in_progress→selection_done), deliveries (pending_review→accepted/revision_requested)
4. **Auth**: JWT Bearer (7d) for photographers, share_token for client portal pages
5. **AI fallback chain**: Claude → DeepSeek → offline rules (keywords/templates)
6. **No ORM** — raw SQL via `queryAll<T>()`, `queryOne<T>()`, `run()`
7. **Docker build uses npm** — pnpm v11 has build script restrictions that break CI

## Server Commands

```bash
# SSH to production
ssh -i ~/.ssh/id_ed25519 ubuntu@123.58.212.114

# Deploy
sudo docker compose -f /home/ubuntu/studiosage/docker-compose.yml up -d --build

# Check status
curl -s http://123.58.212.114/api/health
```

## What NOT to rebuild

- Proposals, Pixieset, Google Calendar/OAuth, Inbox page — all removed (v1.0 cleanup)
- Tauri desktop app — architecture ready but not active (Phase 2+)
- Email-watcher runs in passive mode — AI drafts replies but human must approve before send
