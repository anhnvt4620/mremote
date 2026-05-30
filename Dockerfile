# ── Stage 1: Build native modules ──
FROM node:20-slim AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends make g++ python3 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 2: Production image ──
FROM node:20-slim

WORKDIR /app

# Only runtime deps (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash openssh-client \
  && rm -rf /var/lib/apt/lists/*

# Copy built node_modules with compiled node-pty
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/
COPY ui-dist/ ./ui-dist/

ENV NODE_ENV=production HOST=0.0.0.0 PORT=2208
EXPOSE 2208

CMD ["node", "src/cli/index.js"]
