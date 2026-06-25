# StudioSage Deployment Guide

## Prerequisites

- Ubuntu 20.04+ server with Docker and Docker Compose installed
- Domain name pointed to server IP
- Stripe account (for payments)

## Quick Start

### 1. Generate Secrets

```bash
# Generate strong random secrets
openssl rand -hex 32  # For JWT_SECRET
openssl rand -hex 32  # For CLIENT_JWT_SECRET
openssl rand -hex 32  # For ENCRYPTION_KEY
```

### 2. Create .env File

```bash
cp .env.example .env
# Edit .env with real values — ALL of these are REQUIRED:
#   JWT_SECRET, CLIENT_JWT_SECRET, ENCRYPTION_KEY
# Optional but recommended:
#   ANTHROPIC_API_KEY (or DEEPSEEK_API_KEY), STRIPE_SECRET_KEY
```

### 3. Configure SSL with Let's Encrypt

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com
```

Update `nginx.conf` with correct certificate paths:
```
ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

### 4. Deploy

```bash
# Build and start
sudo docker compose up -d --build

# Check status
curl -s http://localhost:3001/api/health/ready
# {"ok":true,"db":"ok","jwt":"ok"}

# View logs
sudo docker compose logs -f
```

### 5. Verify

- Open `https://yourdomain.com` — should show landing page
- Register a test account at `/sage/register`
- Check health: `curl https://yourdomain.com/api/health`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **Yes** | JWT signing key (min 32 chars) |
| `CLIENT_JWT_SECRET` | **Yes** | Client portal JWT key |
| `ENCRYPTION_KEY` | **Yes** | AES-256 key for email passwords (min 32 chars) |
| `ANTHROPIC_API_KEY` | No | Claude API key for AI features |
| `DEEPSEEK_API_KEY` | No | DeepSeek API key (fallback) |
| `STRIPE_SECRET_KEY` | No | Stripe secret key for payments |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signature verification |
| `STRIPE_PRICE_PRO` | No | Stripe Price ID for Pro plan |
| `STRIPE_PRICE_PRO_ANNUAL` | No | Stripe Price ID for Pro Annual |
| `STRIPE_PRICE_STARTER` | No | Stripe Price ID for Starter plan |
| `SENTRY_DSN` | No | Sentry DSN for error monitoring |
| `APP_URL` | No | Public URL (default: https://hzlmagent.com) |
| `CORS_ORIGIN` | No | CORS origin (default: https://hzlmagent.com) |
| `LOG_LEVEL` | No | debug/info/warn/error (default: info) |
| `LOG_FORMAT` | No | plain/json (default: plain) |

## Database Backups

SQLite database is stored at `data/studiosage.db` (Docker volume `studiosage_data`).

- **Automatic daily backups**: 7 days retained at `data/studiosage-YYYY-MM-DD.db.bak`
- **Latest backup**: `data/studiosage.db.bak` (updated on every write)
- **Manual backup**: `sudo docker compose exec studiosage cp /app/server/data/studiosage.db /app/server/data/backup-$(date +%s).db`

### Restore from Backup

```bash
sudo docker compose exec studiosage sh -c 'cp /app/server/data/studiosage-2026-01-01.db.bak /app/server/data/studiosage.db'
sudo docker compose restart
```

## Stripe Webhook Setup

1. Go to Stripe Dashboard → Webhooks → Add endpoint
2. URL: `https://yourdomain.com/api/webhooks/stripe`
3. Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in `.env`

## Monitoring

- Health check: `GET /api/health` (DB + AI + Stripe status)
- Readiness: `GET /api/health/ready` (used by Docker HEALTHCHECK)
- Data integrity: `GET /api/health/data` (table counts, DB size)
- Error tracking: Set `SENTRY_DSN` for Sentry integration
- Logs: `sudo docker compose logs -f` (set `LOG_FORMAT=json` for structured logging)

## Troubleshooting

### Container won't start
```bash
# Check for missing env vars
sudo docker compose up --build
# If error mentions JWT_SECRET / ENCRYPTION_KEY / CLIENT_JWT_SECRET — set them in .env
```

### Database corruption
The app auto-recovers from backup on restart. If both primary and backup are corrupted:
```bash
sudo docker compose exec studiosage sh -c 'mv /app/server/data/studiosage.db /app/server/data/studiosage.db.corrupted'
sudo docker compose restart  # Creates fresh DB
```

### Email connection fails
- Gmail: Use App Password (not regular password)
- 163/QQ: Use authorization code from email settings
- Check IMAP/SMTP is enabled in email provider settings