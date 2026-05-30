# M-Termius

Self-hosted remote terminal, file explorer, code editor and system monitor — all in one Preact web app, served from your machine.

Forked in spirit from [9remote](https://github.com/decolua/9remote) but **rewritten from scratch** — no obfuscated bundles, no upstream dependency.

```
D:\OneDrive\M-Termius
├── src/
│   ├── cli/index.js          CLI entry — banner, args, server boot
│   ├── server/               Node side
│   │   ├── index.js            HTTP + Socket.IO + static UI
│   │   ├── pty.js              Terminal sessions (node-pty + child_process fallback)
│   │   ├── files.js            File explorer REST API
│   │   ├── editor.js           File language detection
│   │   └── system.js           Host info / metrics
│   └── ui/                   Preact web client
│       ├── index.html
│       ├── public/favicon.svg
│       └── src/
│           ├── main.jsx
│           ├── App.jsx
│           ├── styles.css
│           └── components/
│               ├── Sidebar.jsx
│               ├── Topbar.jsx
│               ├── Terminal.jsx     (xterm.js + WebSocket PTY)
│               ├── FileExplorer.jsx (browse, upload, download, mkdir, delete)
│               ├── Editor.jsx       (textarea editor, Ctrl+S to save)
│               ├── System.jsx       (live host metrics)
│               └── Toast.jsx
├── ui-dist/                  Vite build output (generated)
├── vendor-9remote-dist/      Reference: original 9remote bundle
├── vite.config.js
└── package.json
```

## Quick start

```powershell
npm install
npm run build:ui
npm start              # opens http://localhost:2208
```

For UI dev with hot reload:

```powershell
# terminal 1
npm run ui             # backend at :2208

# terminal 2
npm run dev:ui         # vite dev at :5173 with proxy to backend
```

## Features

| Tab | What it does |
|-----|-------------|
| **Terminal** | Full xterm.js + node-pty over WebSocket. Falls back to `child_process` if node-pty isn't built. PowerShell on Windows, bash on macOS/Linux. |
| **Files** | Browse any path, navigate by typing path, upload (drag/select), download, create/delete files & folders. Double-click a file to open in Editor. |
| **Editor** | Plain-text editor with language detection. `Ctrl+S` to save, dirty indicator. |
| **System** | Live host metrics — CPU model, cores, memory bar, uptime, Node version, machine ID. Refreshes every 3s. |

## API surface

```
GET    /api/health                       liveness
GET    /api/system/info                  host info + metrics
GET    /api/fs/list?path=…                list directory
GET    /api/fs/read?path=…                read file (text up to 2MB)
POST   /api/fs/write    {path, content}   write file
POST   /api/fs/mkdir    {path}            create directory
DELETE /api/fs/delete?path=…              remove file or directory
POST   /api/fs/rename   {from, to}        rename / move
GET    /api/fs/download?path=…            stream a file
POST   /api/fs/upload?dir=…   (multipart) upload one or more files
GET    /api/editor/lang?path=…            language guess by extension

WebSocket  /socket.io/  (namespace `/term`)
  client → start  {cols, rows, cwd?}      spawn shell
  client → input  string                  send keystrokes
  client → resize {cols, rows}            resize PTY
  server → started {pid, shell, cwd}
  server → data string                    pty output
  server → exit  {exitCode}
```

## Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `2208` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `ROOT_DIR` | `os.homedir()` | File explorer root |
| `MTERMIUS_SHELL` | platform default | Override shell (`pwsh`, `bash`, `zsh`, …) |

## Roadmap

- [ ] Pair-device auth (machine ID + QR + approval flow)
- [ ] Cloudflare Quick Tunnel integration for outbound-only remote access
- [ ] Built-in code editor with syntax highlighting (CodeMirror 6)
- [ ] Remote desktop streaming (WebRTC + screen capture)
- [ ] Git status panel
- [ ] Session persistence (PTY daemon survives server restart)
- [ ] Mobile-optimized gestures
- [ ] Tauri shell for native desktop app

## License

MIT.
