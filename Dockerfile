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
# Copy only runtime artifacts (no python3/make/g++ in final image)
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package.json ./server/
COPY --from=client-builder /app/client/dist ./client/dist
RUN mkdir -p /app/server/data/uploads
# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser
ENV PORT=3001 NODE_ENV=production
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3001/api/health/ready || exit 1
CMD ["node", "server/dist/index.js"]
