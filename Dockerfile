FROM node:20-slim

LABEL org.opencontainers.image.title="MRemote"
LABEL org.opencontainers.image.description="Remote terminal, desktop, file explorer"

WORKDIR /app

# System deps for node-pty + optional tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    make g++ python3 bash git openssh-client xdotool \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force

COPY src/ ./src/
COPY ui-dist/ ./ui-dist/

ENV NODE_ENV=production HOST=0.0.0.0 PORT=2208
EXPOSE 2208

CMD ["node", "src/cli/index.js"]
