import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import chalk from 'chalk';
import { CONFIG_DIR, ensureConfigDir } from './utils.js';

const BIN_DIR = path.join(CONFIG_DIR, 'bin');
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const BIN_NAME = isWindows ? 'cloudflared.exe' : 'cloudflared';
const BIN_PATH = path.join(BIN_DIR, BIN_NAME);

const TUNNEL_TIMEOUT = 30000; // 30 seconds max wait for tunnel URL

function downloadUrl() {
  const arch = process.arch;
  if (isWindows) {
    return arch === 'ia32'
      ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-386.exe'
      : 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';
  }
  if (isMac) {
    return arch === 'arm64'
      ? 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz'
      : 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz';
  }
  const linuxArch = arch === 'arm64' ? 'arm64' : arch === 'arm' ? 'arm' : 'amd64';
  return `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${linuxArch}`;
}

function follow(url, file) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        follow(res.headers.location, file).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`download failed: HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function ensureBinary() {
  if (fs.existsSync(BIN_PATH)) return BIN_PATH;
  ensureConfigDir();
  if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });

  const url = downloadUrl();
  if (url.endsWith('.tgz')) {
    throw new Error(
      'macOS .tgz auto-extract not yet implemented — install cloudflared via brew: `brew install cloudflared`'
    );
  }
  console.log(chalk.dim(`   Downloading cloudflared from ${url}…`));
  const file = fs.createWriteStream(BIN_PATH, { mode: 0o755 });
  await follow(url, file);
  if (!isWindows) {
    try { fs.chmodSync(BIN_PATH, 0o755); } catch {}
  }
  return BIN_PATH;
}

function findExisting() {
  if (fs.existsSync(BIN_PATH)) return BIN_PATH;
  return null;
}

/**
 * Start a Cloudflare Quick Tunnel.
 * Resolves with { url, stop: () => void } on success, or null on failure.
 * Cleans up the child process on timeout or error.
 */
export async function startTunnel({ port, autoDownload = true }) {
  let bin = findExisting();
  if (!bin) {
    if (!autoDownload) throw new Error('cloudflared not found and autoDownload disabled');
    try {
      bin = await ensureBinary();
    } catch (err) {
      console.log(chalk.yellow('\u26a0'), `Tunnel disabled: ${err.message}`);
      return null;
    }
  }

  const proc = spawn(bin, ['tunnel', '--url', `http://localhost:${port}`, '--no-autoupdate'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  return new Promise((resolve) => {
    let url = null;
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
      // Kill the process and all stderr/stdout listeners
      try { proc.kill('SIGTERM'); } catch {}
      // Give it a moment, then force kill
      setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch {}
      }, 1000);
    };

    const timeout = setTimeout(cleanup, TUNNEL_TIMEOUT);

    const onLine = (line) => {
      const m = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (m && !resolved) {
        url = m[0];
        resolved = true;
        clearTimeout(timeout);
        resolve({ url, stop: () => { try { proc.kill(); } catch {} } });
      }
    };

    proc.stdout.on('data', (d) => d.toString('utf8').split('\n').forEach(onLine));
    proc.stderr.on('data', (d) => d.toString('utf8').split('\n').forEach(onLine));

    proc.on('exit', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(null);
      }
    });

    proc.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(null);
      }
    });
  });
}
