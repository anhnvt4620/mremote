import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ---- Constants ----

export const CONFIG_DIR = path.join(os.homedir(), '.m-termius');

// ---- Config directory ----

export function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

// ---- JSON persistence ----

export function loadJson(fileName, defaults = {}) {
  ensureConfigDir();
  const filePath = path.join(CONFIG_DIR, fileName);
  if (!fs.existsSync(filePath)) return typeof defaults === 'function' ? defaults() : defaults;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return typeof defaults === 'function' ? defaults() : defaults;
  }
}

export function saveJson(fileName, data) {
  ensureConfigDir();
  const filePath = path.join(CONFIG_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

// ---- Path safety: prevent traversal outside root ----

/**
 * Resolves a user-provided path relative to rootDir, ensuring it stays within rootDir.
 * Throws a PermissionError if the resolved path escapes the root.
 */
export function safeResolve(rootDir, target) {
  if (!target) return rootDir;

  // Expand ~ to home directory
  const expanded = target.startsWith('~')
    ? path.join(os.homedir(), target.slice(1))
    : target;

  // Join with rootDir if relative
  const abs = path.isAbsolute(expanded)
    ? path.resolve(expanded)
    : path.resolve(rootDir, expanded);

  // Security: ensure the resolved path stays within rootDir
  const normalizedRoot = path.resolve(rootDir);
  if (!abs.startsWith(normalizedRoot + path.sep) && abs !== normalizedRoot) {
    const err = new Error(`Path traversal denied: "${target}" escapes root directory`);
    err.code = 'E_PATH_TRAVERSAL';
    err.statusCode = 403;
    throw err;
  }

  return abs;
}

// ---- Exec helpers ----

import { exec, spawn } from 'node:child_process';

/**
 * Execute a command and return stdout. Uses spawn to avoid command injection.
 */
export function execCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (d) => stdout.push(d));
    child.stderr.on('data', (d) => stderr.push(d));
    child.on('error', reject);
    child.on('close', (code) => {
      const out = Buffer.concat(stdout).toString('utf8');
      const err = Buffer.concat(stderr).toString('utf8');
      if (code === 0) resolve(out);
      else reject(new Error((err || `exit code ${code}`).trim()));
    });
  });
}

// ---- Rate limiter ----

const rateLimiters = new Map();

export function rateLimit(key, { windowMs = 1000, max = 30 } = {}) {
  const now = Date.now();
  let entry = rateLimiters.get(key);
  if (!entry || now - entry.start > windowMs) {
    entry = { start: now, count: 0 };
    rateLimiters.set(key, entry);
  }
  entry.count++;
  return entry.count <= max;
}

// Clean old entries periodically
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [key, entry] of rateLimiters) {
    if (entry.start < cutoff) rateLimiters.delete(key);
  }
}, 30000).unref();

// ---- Error response helper ----

export function sendError(res, err, fallbackStatus = 500) {
  const status = err.statusCode || err.status || fallbackStatus;
  res.status(status).json({ error: err.message || 'Internal server error' });
}

// ---- Crypto helpers ----

import crypto from 'node:crypto';

export function randomToken(len = 32) {
  return crypto.randomBytes(len).toString('base64url');
}

export function randomId(bytes = 8) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function randomDigits(min, max) {
  return crypto.randomInt(min, max).toString();
}
