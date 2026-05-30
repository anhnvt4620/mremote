<p align="center">
  <img src="https://img.shields.io/npm/v/mremote?color=e66a4a&label=npm" alt="npm">
  <img src="https://img.shields.io/badge/docker-ghcr-blue?logo=docker" alt="docker">
  <img src="https://img.shields.io/badge/node-18%2B-brightgreen?logo=node.js" alt="node">
  <img src="https://img.shields.io/github/license/anhnvt4620/mremote" alt="MIT">
</p>

# MRemote — Terminal in Your Pocket

**Remote terminal, desktop streaming, file explorer, and system management — all from your browser. One command, no config.**

> Control your Mac/Linux/Windows from any phone or browser, anywhere, instantly.

[Quick Start](#-quick-start) · [Features](#-features) · [Docker](#-docker) · [Security](#-security)

---

## Why MRemote?

| Problem | Solution |
|---|---|
| SSH needs firewall, port forwarding, keys | Auto Cloudflare tunnel, just scan QR |
| TeamViewer slow, no terminal | Browser-based, <50ms latency |
| ngrok URLs expire on restart | Pair auth persists across restarts |
| Termius SSH-only, no desktop | Terminal + Desktop + Files + Git + Docker |

---

## Quick Start

### Local

```bash
node src/cli/index.js
```

Open `http://localhost:2208` — scan QR, pair device, done.

### With auth on (default)

```
Pair code:  123456
Pair URL:   http://your-server:2208/pair?code=123456
```

### Without auth (local only)

```bash
node src/cli/index.js --no-auth
```

### Docker (1 dòng)

```bash
docker run -d --name mremote -p 2208:2208 --restart unless-stopped ghcr.io/anhnvt4620/mremote:latest
```

---

## Features

### Terminal
Multi-tab PTY terminal with 6 themes, session rename, command snippets. Works with any CLI tool including Claude Code, Codex, Gemini CLI.

### Remote Desktop
Real-time screen streaming. Click, drag, scroll to control your desktop from any browser. Adjustable quality: High / Medium / Low.

### SSH Client
Manage SSH hosts with password or private key auth. Test connection, multi-tab sessions.

### File Explorer
Browse, upload, download, create, rename, delete files. Full tree navigation with breadcrumbs.

### Code Editor
Syntax highlighting for 20+ languages via CodeMirror 6. JavaScript, Python, Go, Rust, HTML, CSS, JSON, Markdown, and more.

### Git Integration
Visual status, diff viewer, stage/unstage, commit with message, push/pull — all from browser.

### Docker Manager
List containers and images, start/stop/restart/kill, view logs. No CLI needed.

### Process Manager
View and kill processes. Cross-platform: taskkill on Windows, kill on Unix. Sort by CPU/memory.

### System Dashboard
CPU, memory, uptime, hostname, platform, architecture, Node version — real-time.

### Sites Proxy
Auto-detect local dev servers (port 3000, 5173, 8080...) and proxy them for mobile testing.

### HTTP Client
Build and send HTTP requests with custom headers, body, and method. Response viewer with timing.

### Live Logs
Tail log files in real-time via WebSocket. Handles log rotation gracefully.

### AI-Ready
Use Claude Code, Codex, Gemini CLI, or any terminal-based AI tool on your host machine from anywhere.

---

## Security

| Layer | Detail |
|---|---|
| Pair Auth | One-time 6-digit code, expires 30 min |
| Token Auth | Bearer token for HTTP + WebSocket |
| CORS | Restricted to localhost origins |
| Container | Non-root user, read-only FS, no-new-privileges |
| Tunnel | Optional Cloudflare tunnel, no open ports |

---

## Docker

```bash
# Run
docker run -d --name mremote -p 2208:2208 ghcr.io/anhnvt4620/mremote:latest

# With auth on
docker run -d --name mremote -p 2208:2208 ghcr.io/anhnvt4620/mremote:latest
docker logs mremote  # get pair code

# With docker-compose
curl -O https://raw.githubusercontent.com/anhnvt4620/mremote/master/docker-compose.yml
docker-compose up -d
```

---

## Available Platforms

| Platform | Status |
|---|---|
| Windows (host) | ✅ |
| macOS (host) | ✅ |
| Linux (host) | ✅ |
| Any browser (client) | ✅ — Chrome, Safari, Firefox, Edge |
| Mobile browser (client) | ✅ — iOS Safari, Android Chrome |
| Docker | ✅ — GHCR image |
| Desktop (Tauri) | 🚧 — Windows only |

---

## Comparison

| Feature | MRemote | 9remote | Termius | TeamViewer |
|---|---|---|---|---|
| Terminal | ✅ | ✅ | ✅ | ❌ |
| Remote Desktop | ✅ | ✅ | ❌ | ✅ |
| File Explorer | ✅ | ✅ | ✅ | ✅ |
| Code Editor | ✅ | ✅ | ❌ | ❌ |
| Git Integration | ✅ | ✅ | ❌ | ❌ |
| Docker Manager | ✅ | ❌ | ❌ | ❌ |
| Process Manager | ✅ | ❌ | ❌ | ❌ |
| System Dashboard | ✅ | ❌ | ❌ | ❌ |
| HTTP Client | ✅ | ❌ | ❌ | ❌ |
| Log Tailer | ✅ | ❌ | ❌ | ❌ |
| Sites Proxy | ✅ | ✅ | ❌ | ❌ |
| QR Pair Auth | ✅ | ✅ | ❌ | ❌ |
| Cloudflare Tunnel | ✅ | ✅ | ❌ | ❌ |
| Docker Deploy | ✅ | ❌ | ❌ | ❌ |
| Open Source | ✅ | ❌ | ❌ | ❌ |
| **TOTAL** | **15 / 15** | 12 | 5 | 3 |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Node.js 20, Express, Socket.IO |
| Terminal | node-pty (native), child_process (fallback) |
| SSH | ssh2 |
| Desktop | screenshot-desktop |
| Frontend | Preact, xterm.js, CodeMirror 6 |
| Build | Vite, esbuild |
| Deploy | Docker, GHCR |

---

## License

MIT — fully open source. Use it, modify it, deploy it anywhere.
