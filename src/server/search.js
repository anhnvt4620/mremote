import fs from 'node:fs/promises';
import path from 'node:path';
import { safeResolve, sendError, rateLimit } from './utils.js';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.vite', '.cache',
  'vendor', 'target', '__pycache__', '.idea', '.vscode',
]);
const MAX_FILES = 4000;
const MAX_FILE_SIZE = 1.5 * 1024 * 1024; // 1.5 MB
const MAX_RESULTS = 800;

function buildRegex(pattern, isRegex, caseSensitive) {
  if (!pattern) return null;
  const flags = caseSensitive ? 'g' : 'gi';
  if (isRegex) {
    try { return new RegExp(pattern, flags); } catch { return null; }
  }
  return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
}

function matchGlob(name, glob) {
  if (!glob) return true;
  const re = new RegExp(
    '^' +
    glob
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((g) => g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.'))
      .map((g) => `(${g})`)
      .join('|') +
    '$',
    'i'
  );
  return re.test(name);
}

async function* walk(root) {
  let count = 0;
  const queue = [root];
  while (queue.length) {
    const dir = queue.shift();
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
        queue.push(full);
      } else if (e.isFile()) {
        count++;
        if (count > MAX_FILES) return;
        yield full;
      }
    }
  }
}

export function registerSearchRoutes(app, { rootDir }) {
  app.post('/api/search', async (req, res) => {
    // Rate limit: max 10 searches per 15 seconds per IP
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!rateLimit(`search:${clientIp}`, { windowMs: 15000, max: 10 })) {
      return res.status(429).json({ error: 'too many requests — wait 15 seconds' });
    }

    try {
      const b = req.body || {};
      const query = String(b.query || '').trim();
      if (!query) return res.status(400).json({ error: 'query required' });

      const root = safeResolve(rootDir, b.cwd || '');
      const re = buildRegex(query, !!b.regex, !!b.caseSensitive);
      if (!re) return res.status(400).json({ error: 'invalid regex' });

      const glob = b.glob || '';
      const includeContent = b.kind !== 'name';

      const results = [];
      let scanned = 0, matched = 0;

      for await (const file of walk(root)) {
        scanned++;
        const base = path.basename(file);
        if (!matchGlob(base, glob)) continue;

        // Name-only search
        if (b.kind === 'name') {
          if (re.test(base)) {
            results.push({ file, hits: [{ line: 0, col: 0, text: base }] });
            matched++;
            if (matched >= MAX_RESULTS) break;
          }
          continue;
        }

        // Content search
        let stat;
        try { stat = await fs.stat(file); } catch { continue; }
        if (stat.size > MAX_FILE_SIZE) continue;

        let buf;
        try { buf = await fs.readFile(file); } catch { continue; }
        if (buf.subarray(0, 4096).includes(0)) continue; // skip binary
        const text = buf.toString('utf8');

        const hits = [];
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          re.lastIndex = 0;
          const m = re.exec(line);
          if (m) {
            hits.push({ line: i + 1, col: m.index + 1, text: line.slice(0, 240) });
            if (hits.length >= 5) break;
          }
        }
        if (hits.length) {
          results.push({ file, hits });
          matched++;
          if (matched >= MAX_RESULTS) break;
        }
      }

      res.json({
        root,
        scanned,
        matched: results.length,
        truncated: matched >= MAX_RESULTS,
        results,
      });
    } catch (err) {
      sendError(res, err, 500);
    }
  });
}
