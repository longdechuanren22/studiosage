FROM node:22-alpine AS client-builder
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install --legacy-peer-deps 2>/dev/null || npm install
COPY client/ .
RUN npm run build

FROM node:22-alpine AS server-builder
WORKDIR /app/server
RUN apk add --no-cache python3 make g++
COPY server/package.json server/package-lock.json* ./
RUN npm install --legacy-peer-deps 2>/dev/null || npm install
COPY server/ .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache python3
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package.json ./server/
COPY --from=client-builder /app/client/dist ./client/dist
RUN mkdir -p /app/server/data/uploads
ENV PORT=3001 NODE_ENV=production
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
