# StudioSage

AI photography studio manager. Sits on top of your existing tools — responds to clients, generates invoices, and manages your pipeline while you shoot.

## Tech Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + PWA
- **Backend:** Node.js + Express + TypeScript
- **Database:** SQLite (via sql.js)
- **AI:** Claude Haiku 4.5 (message classification, reply generation, invoice parsing)
- **Integrations:** Pixieset, Google Calendar, Stripe

## Quick Start

```bash
# 1. Install dependencies
pnpm install
cd server && pnpm install && cd ..
cd client && pnpm install && cd ..

# 2. Set up environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start dev servers
pnpm dev
# → API: http://localhost:3001
# → UI:  http://localhost:5173
```

## Environment Variables

| Variable | Required | Description |
|----------|:--:|------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for AI engine |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret for payment links |
| `PIXIESET_API_KEY` | No | Pixieset API for gallery progress |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `PORT` | No | Server port (default: 3001) |

## Docker Deploy

```bash
cp .env.example .env  # Edit with real keys
docker-compose up -d
```

## Architecture

```
Client → React PWA (mobile-friendly)
  ↓ /api/*
Server → Express + TypeScript
  ├── /ai-engine   Claude Haiku (classify, reply, invoice)
  ├── /adapters    Pixieset, Google Calendar, Stripe
  ├── /db          SQLite (via sql.js)
  └── /api         REST endpoints
```

## Pricing

$19/month. Free 14-day trial. Unlimited AI replies.

## License

Proprietary.
