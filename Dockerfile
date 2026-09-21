# ── Stage 1: install dependencies ────────────────────────────────────────────
FROM node:20-slim AS deps

WORKDIR /app

COPY app/package.json app/package-lock.json ./

# Install prod deps only (skip React/Vite/TypeScript build tools)
RUN npm ci --omit=dev --ignore-scripts

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /app

# Copy installed modules and server source
COPY --from=deps /app/node_modules ./node_modules
COPY app/package.json ./
COPY app/server ./server

# Persistent volume will be mounted at /data — pre-create dirs so first boot works
RUN mkdir -p /data/auth /data/media

EXPOSE 8787

ENV NODE_ENV=production
ENV DATA_DIR=/data

CMD ["node", "server/src/index.js"]
