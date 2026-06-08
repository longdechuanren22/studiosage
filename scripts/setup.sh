#!/bin/bash
# StudioSage one-command setup
set -e

echo "📸 StudioSage Setup"
echo "==================="
echo ""

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required. Install: https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm required. Install: npm i -g pnpm"; exit 1; }

echo "✅ Node $(node -v)"
echo "✅ pnpm $(pnpm -v)"

# Install deps
echo ""
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
cd server && pnpm install --frozen-lockfile 2>/dev/null || pnpm install
cd ../client && pnpm install --frozen-lockfile 2>/dev/null || pnpm install
cd ..

# Setup env
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "⚠️  Created .env from .env.example"
  echo "   Edit .env and add your ANTHROPIC_API_KEY + STRIPE_SECRET_KEY"
  echo "   Then run: docker-compose up -d"
else
  echo "✅ .env exists"
fi

echo ""
echo "Setup complete. Next:"
echo "  1. Edit .env with your API keys"
echo "  2. docker-compose up -d"
echo "  3. Open http://localhost:3001"
