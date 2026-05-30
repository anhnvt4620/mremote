# ── Stage 1: Build native modules (discarded) ──
FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends make g++ python3 \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 2: Production ──
FROM node:20-slim
WORKDIR /app

# Runtime deps only
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash openssh-client \
  && rm -rf /var/lib/apt/lists/*

# Copy compiled node_modules + source
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/
COPY ui-dist/ ./ui-dist/

# Create non-root user with real home dir
RUN addgroup --system --gid 1001 app && adduser --system --uid 1001 --gid 1001 --home /home/app app \
  && mkdir -p /home/app/.mtermius && chown -R app:app /app /home/app

USER app

ENV HOME=/home/app NODE_ENV=production HOST=0.0.0.0 PORT=2208
EXPOSE 2208

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "require('http').get('http://localhost:2208/api/health',r=>{process.exit(r.statusCode===200?0:1)})"

CMD ["node", "src/cli/index.js"]
