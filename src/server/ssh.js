import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Client } from 'ssh2';
import { loadJson, saveJson, randomToken, sendError } from './utils.js';

const HOSTS_FILE = 'ssh-hosts.json';

function loadHosts() {
  return loadJson(HOSTS_FILE, []);
}

function saveHosts(hosts) {
  saveJson(HOSTS_FILE, hosts);
}

function publicHost(h) {
  return {
    id: h.id,
    label: h.label,
    host: h.host,
    port: h.port,
    user: h.user,
    auth: h.auth,
    privateKeyPath: h.privateKeyPath || null,
    hasPassword: !!h.password,
    color: h.color || null,
    lastUsed: h.lastUsed || null,
  };
}

export function registerSshRoutes(app, _ctx) {
  // List hosts
  app.get('/api/ssh/hosts', (_req, res) => {
    res.json({ hosts: loadHosts().map(publicHost) });
  });

  // Create or update host
  app.post('/api/ssh/hosts', (req, res) => {
    try {
      const b = req.body || {};
      if (!b.host || !b.user) return res.status(400).json({ error: 'host and user required' });
      const hosts = loadHosts();
      const id = b.id || randomToken(6);
      const idx = hosts.findIndex((h) => h.id === id);
      const next = {
        id,
        label: (b.label || `${b.user}@${b.host}`).slice(0, 64),
        host: String(b.host).trim(),
        port: Number(b.port) || 22,
        user: String(b.user).trim(),
        auth: b.auth === 'key' ? 'key' : 'password',
        privateKeyPath: b.privateKeyPath || null,
        password: b.password || null,
        passphrase: b.passphrase || null,
        color: b.color || null,
        lastUsed: null,
      };
      if (idx >= 0) hosts[idx] = { ...hosts[idx], ...next };
      else hosts.push(next);
      saveHosts(hosts);
      res.json(publicHost(next));
    } catch (err) {
      sendError(res, err, 500);
    }
  });

  // Delete host
  app.delete('/api/ssh/hosts/:id', (req, res) => {
    try {
      const hosts = loadHosts();
      const next = hosts.filter((h) => h.id !== req.params.id);
      if (next.length === hosts.length) return res.status(404).json({ error: 'not found' });
      saveHosts(next);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err, 500);
    }
  });

  // Test connection
  app.post('/api/ssh/test/:id', (req, res) => {
    const hosts = loadHosts();
    const h = hosts.find((x) => x.id === req.params.id);
    if (!h) return res.status(404).json({ error: 'not found' });
    const conn = new Client();
    let done = false;
    const finish = (status, error) => {
      if (done) return;
      done = true;
      try { conn.end(); } catch {}
      if (status === 'ok') res.json({ ok: true });
      else res.status(400).json({ error });
    };
    conn.on('ready', () => finish('ok'));
    conn.on('error', (err) => finish('err', err.message));
    setTimeout(() => finish('err', 'timeout'), 8000);
    try {
      conn.connect(buildConnectConfig(h));
    } catch (err) {
      finish('err', err.message);
    }
  });
}

function buildConnectConfig(host) {
  const cfg = {
    host: host.host,
    port: host.port,
    username: host.user,
    readyTimeout: 8000,
    keepaliveInterval: 30000,
  };
  if (host.auth === 'key') {
    if (!host.privateKeyPath) throw new Error('privateKeyPath required');
    const keyPath = host.privateKeyPath.startsWith('~')
      ? path.join(os.homedir(), host.privateKeyPath.slice(1))
      : host.privateKeyPath;
    cfg.privateKey = fs.readFileSync(keyPath);
    if (host.passphrase) cfg.passphrase = host.passphrase;
  } else {
    cfg.password = host.password || '';
  }
  return cfg;
}

function touchHostLastUsed(id) {
  const hosts = loadHosts();
  const h = hosts.find((x) => x.id === id);
  if (h) {
    h.lastUsed = Date.now();
    saveHosts(hosts);
  }
}

export function attachSsh(io) {
  const ns = io.of('/ssh');
  ns.on('connection', (socket) => {
    let conn = null;
    let stream = null;

    socket.on('connect-host', ({ id, cols, rows } = {}) => {
      const hosts = loadHosts();
      const host = hosts.find((h) => h.id === id);
      if (!host) {
        socket.emit('error', { message: 'host not found' });
        return;
      }
      conn = new Client();
      conn.on('ready', () => {
        touchHostLastUsed(id);
        conn.shell({ cols: cols || 80, rows: rows || 24, term: 'xterm-256color' }, (err, s) => {
          if (err) {
            socket.emit('error', { message: err.message });
            return;
          }
          stream = s;
          socket.emit('connected', { host: `${host.user}@${host.host}` });
          stream.on('data', (d) => socket.emit('data', d.toString('utf8')));
          stream.stderr.on('data', (d) => socket.emit('data', d.toString('utf8')));
          stream.on('close', () => {
            socket.emit('exit', { exitCode: 0 });
            try { conn.end(); } catch {}
          });
        });
      });
      conn.on('error', (err) => socket.emit('error', { message: err.message }));
      conn.on('close', () => socket.emit('exit', { exitCode: 0 }));
      try {
        conn.connect(buildConnectConfig(host));
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('input', (d) => {
      try {
        if (stream) stream.write(d);
      } catch {}
    });

    socket.on('resize', ({ cols, rows }) => {
      if (stream) {
        try { stream.setWindow(rows, cols); } catch {}
      }
    });

    socket.on('disconnect', () => {
      try { stream?.end(); } catch {}
      try { conn?.end(); } catch {}
      stream = null;
      conn = null;
    });
  });
}
