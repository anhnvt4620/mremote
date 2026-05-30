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

# Runtime deps + locale UTF-8 + nsenter (host access)
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash openssh-client locales util-linux \
  && echo "en_US.UTF-8 UTF-8" > /etc/locale.gen && locale-gen en_US.UTF-8 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/
COPY ui-dist/ ./ui-dist/
COPY docker-entrypoint.sh /docker-entrypoint.sh

# Create user home + config dir (writable by any UID via docker user: option)
RUN mkdir -p /home/app/.mtermius && chmod -R 777 /home/app /app && chmod +x /docker-entrypoint.sh

ENV HOME=/home/app LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 NODE_ENV=production HOST=0.0.0.0 PORT=2208
EXPOSE 2208

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "require('http').get('http://localhost:2208/api/health',r=>{process.exit(r.statusCode===200?0:1)})"

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["--no-tunnel"]
