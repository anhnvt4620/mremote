# ── Build stage ──
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for node-pty (make, g++, python3)
RUN apk add --no-cache make g++ python3

COPY package.json package-lock.json ./
RUN npm ci --production=false

COPY . .
RUN npm run build:ui

# ── Production stage ──
FROM node:20-alpine

LABEL org.opencontainers.image.title="M-Termius"
LABEL org.opencontainers.image.description="Remote terminal, desktop, file explorer in your pocket"
LABEL org.opencontainers.image.version="0.5.0"

WORKDIR /app

# Install runtime dependencies for node-pty
RUN apk add --no-cache make g++ python3 bash git docker-cli openssh-client

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Rebuild node-pty native module for musl (alpine)
RUN cd node_modules/node-pty && npm run rebuild 2>/dev/null || true

COPY --from=builder /app/ui-dist ./ui-dist
COPY src/ ./src/
COPY scripts/ ./scripts/

# Ensure proper permissions
RUN chown -R node:node /app
USER node

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=2208

EXPOSE 2208

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:2208/api/health || exit 1

CMD ["node", "src/cli/index.js"]
