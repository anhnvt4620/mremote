# MRemote

**Remote terminal, desktop streaming, file explorer, and system management -- all from your browser.**

## Features

| Feature | Description |
|---|---|
| Multi-tab Terminal | Full PTY support with 6 themes, rename, snippets |
| SSH Client | Password + key auth, host manager, test connection |
| Remote Desktop | Real-time screen streaming with mouse/keyboard |
| File Explorer | Browse, create, rename, delete, upload, download |
| Code Editor | Syntax highlighting for 20+ languages (CodeMirror 6) |
| Git Integration | Status, diff, stage, commit, push, pull |
| Docker Manager | List containers/images, start/stop, view logs |
| Process Manager | List processes, cross-platform kill |
| System Dashboard | CPU, memory, uptime, host info |
| HTTP Client | Build and send HTTP requests |
| Log Tailer | Live log streaming via WebSocket |
| Site Proxy | Access local dev servers through proxy |
| Cloudflare Tunnel | Remote access without port forwarding |
| Device Auth | QR code pairing, token management |

## Quick Start

```bash
node src/cli/index.js
```

Open http://localhost:2208

### With Docker

```bash
docker-compose up -d --build
```

### On Linux Server

```bash
git clone https://github.com/anhnvt4620/mremote.git
cd mremote
docker-compose up -d --build
```

## Tech Stack

- **Backend:** Node.js, Express, Socket.IO, ssh2, node-pty, screenshot-desktop
- **Frontend:** Preact, xterm.js, CodeMirror 6, Socket.IO Client
- **Desktop Shell:** Tauri (Rust) -- optional
- **Deploy:** Docker, Docker Compose
