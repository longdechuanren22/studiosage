FROM node:22-alpine AS client-builder
WORKDIR /app/client
COPY client/package.json client/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY client/ .
RUN pnpm build

FROM node:22-alpine AS server-builder
WORKDIR /app/server
RUN apk add --no-cache python3 make g++  # sharp native build
COPY server/package.json server/pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY server/ .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app

# Runtime deps for sharp + better-sqlite3
RUN apk add --no-cache python3

COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package.json ./server/
COPY --from=client-builder /app/client/dist ./client/dist

# Data persistence
RUN mkdir -p /app/server/data/uploads

ENV PORT=3001 NODE_ENV=production
EXPOSE 3001

CMD ["node", "server/dist/index.js"]
