<p align="center">
  <img src="https://img.shields.io/badge/Node-18%2B-339933?logo=node.js" alt="Node.js 18+">
  <img src="https://img.shields.io/badge/Docker-✓-2496ED?logo=docker" alt="Docker">
  <img src="https://img.shields.io/github/license/anhnvt4620/mremote" alt="License MIT">
</p>

# MRemote

**Remote terminal, desktop streaming, file explorer, and system management — all from your browser.**

Access your computer from anywhere. No port forwarding, no VPN, no complex setup. Just one command.

---

## Features

### Terminal
Multi-tab terminal with full PTY support, 6 themes, session rename, and command snippets.

- Switch between multiple terminal sessions instantly
- 6 built-in themes: Dark, Light, Dracula, Monokai, Solarized Dark, Solarized Light
- Double-click tab to rename
- Snippet library for frequently used commands

### SSH Client
Connect to remote servers with password or private key authentication.

- Save and manage SSH hosts
- Test connection before connecting
- Full terminal emulation for SSH sessions

### Remote Desktop
Stream your desktop screen in real-time with full mouse and keyboard control.

- Click, drag, scroll — control any application remotely
- Adjustable quality: High / Medium / Low
- Cross-platform (Windows, macOS, Linux)

### File Explorer
Browse, create, edit, rename, delete, upload and download files.

- Tree navigation with breadcrumbs
- Upload files via drag & drop
- Download files with proper MIME types

### Code Editor
Built-in editor with syntax highlighting for 20+ languages via CodeMirror 6.

JavaScript, TypeScript, Python, Go, Rust, HTML, CSS, JSON, Markdown, YAML, and more.

### Git Integration
Full Git workflow from the browser.

- View status, diff, and commit history
- Stage / unstage / discard files
- Commit with message, push, pull

### Docker Manager
Manage containers and images without the CLI.

- List containers and images
- Start, stop, restart, kill containers
- View live logs

### Process Manager
View and manage running processes.

- Sort by CPU or memory
- Cross-platform process kill (taskkill on Windows, kill on Unix)
- Search and filter

### System Dashboard
Real-time system information at a glance.

- CPU, memory, uptime, hostname, architecture
- Machine ID for identification
- Node.js version and platform details

### HTTP Client
Build and send HTTP requests directly from the browser.

- GET, POST, PUT, PATCH, DELETE methods
- Custom headers and body
- Response viewer with timing

### Live Logs
Tail log files in real-time via WebSocket streaming.

- Follow file changes automatically
- Handles log rotation gracefully
- Configurable tail size

### Local Site Proxy
Access your local dev servers through a proxy with HTML rewriting.

- Auto-detects common dev ports (3000, 4000, 5173, 8080, etc.)
- Proxies any port on localhost

### Security
Device pairing with QR codes ensures only authorized devices can connect.

- Pairing codes expire after 30 minutes
- Token-based authentication for HTTP and WebSocket
- CORS restricted to localhost origins

---

## Quick Start

### Local

```bash
node src/cli/index.js
```

Open http://localhost:2208

### Docker

```bash
docker run -d --name mremote -p 2208:2208 --restart unless-stopped ghcr.io/anhnvt4620/mremote:latest
```

### Docker Compose

```bash
git clone https://github.com/anhnvt4620/mremote.git
cd mremote
docker-compose up -d
```

---

## Screenshots

| Terminal | File Explorer | Git |
|---|---|---|
| Multi-tab with themes | Tree view + editor | Status, diff, commit |

| Desktop | Docker | Process |
|---|---|---|
| Screen streaming | Containers & logs | Process management |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, Socket.IO |
| Shell | node-pty (native), child_process (fallback) |
| SSH | ssh2 |
| Terminal UI | xterm.js, FitAddon, WebLinksAddon |
| Frontend | Preact, Vite |
| Editor | CodeMirror 6 |
| Desktop | screenshot-desktop |
| Container | Docker, GHCR |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `2208` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `ROOT_DIR` | `~/` | File explorer root directory |
| `MTERMIUS_SHELL` | `powershell` / `bash` | Override default shell |
| `MTERMIUS_NO_AUTH` | — | Disable pairing authentication |

---

## CLI Options

```
mremote --help

Commands:
  start, ui     Start web UI server (default)

Options:
  --no-auth     Disable pairing (open access)
  --no-tunnel   Disable Cloudflare tunnel
  --version     Print version
  --help        Show this help
```

---

## License

MIT
