import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import { Server as IOServer } from 'socket.io';
import chalk from 'chalk';
import { registerFileRoutes } from './files.js';
import { registerEditorRoutes } from './editor.js';
import { registerSystemRoutes } from './system.js';
import { registerProcessRoutes } from './process.js';
import { registerAuthRoutes } from './authRoutes.js';
import { registerSettingsRoutes } from './settings.js';
import { registerGitRoutes } from './git.js';
import { registerProxyRoutes } from './proxy.js';
import { registerSshRoutes, attachSsh } from './ssh.js';
import { registerSnippetRoutes } from './snippets.js';
import { registerSearchRoutes } from './search.js';
import { registerDockerRoutes } from './docker.js';
import { registerHttpClientRoutes } from './httpClient.js';
import { attachLogs } from './logs.js';
import { attachPty } from './pty.js';
import { attachDesktop } from './desktop.js';

export async function startServer({ port, host, rootDir, projectRoot, auth }) {
  const app = express();

  // ---- CORS: restrict to localhost + configured origins ----
  const corsOrigins = [
    'http://localhost',
    'http://127.0.0.1',
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    // Tauris dev server
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
  // Also allow the Tauri webview origin (tauri://localhost)
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., Tauri webview, curl)
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin) || origin.startsWith('tauri://')) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '10mb' }));

  const ctx = { rootDir, projectRoot, auth, selfPort: port };

  // ---- Health endpoint (no auth required) ----
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now(), version: '0.5.0' });
  });

  registerAuthRoutes(app, ctx);
  app.use(auth.httpMiddleware);

  registerSystemRoutes(app, ctx);
  registerFileRoutes(app, ctx);
  registerEditorRoutes(app, ctx);
  registerProcessRoutes(app, ctx);
  registerSettingsRoutes(app, ctx);
  registerGitRoutes(app, ctx);
  registerProxyRoutes(app, ctx);
  registerSshRoutes(app, ctx);
  registerSnippetRoutes(app, ctx);
  registerSearchRoutes(app, ctx);
  registerDockerRoutes(app, ctx);
  registerHttpClientRoutes(app, ctx);

  // ---- Serve UI (no-cache for development, max-age for production) ----
  const uiDist = path.join(projectRoot, 'ui-dist');
  if (fs.existsSync(uiDist)) {
    app.use(express.static(uiDist, {
      setHeaders: (res, filePath) => {
        // JS/CSS assets are hashed - cache aggressively
        if (filePath.match(/\.(js|css|woff2?|ttf|svg|png|ico)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // HTML should not be cached during development
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(uiDist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.status(503).send(
        '<h1>M-Termius</h1><p>UI not built yet. Run <code>npm run build:ui</code>.</p>'
      );
    });
  }

  // ---- Global error handler ----
  app.use((err, _req, res, _next) => {
    console.error(chalk.red('[error]'), err);
    const status = err.statusCode || err.status || 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  // ---- Socket.IO ----
  const server = http.createServer(app);
  const io = new IOServer(server, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    maxHttpBufferSize: 10 * 1024 * 1024,
  });

  io.use(auth.socketMiddleware);
  attachPty(io, ctx);
  attachSsh(io);
  attachLogs(io, ctx);
  attachDesktop(io);

  await new Promise((resolve) => server.listen(port, host, resolve));
  console.log(chalk.green('\ud83c\udf10'), `UI ready at ${chalk.cyan(`http://localhost:${port}`)}`);
  console.log(chalk.dim(`   Root dir: ${rootDir}`));
  console.log(chalk.dim(`   UI build: ${fs.existsSync(uiDist) ? 'present' : chalk.yellow('missing \u2014 run `npm run build:ui`')}`));
  console.log();

  return { server, io };
}
