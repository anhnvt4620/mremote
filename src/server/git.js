import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { safeResolve, sendError } from './utils.js';

const MAX_BUFFER = 1024 * 1024 * 32; // 32 MB

/**
 * Run a git command in cwd using spawn (safe — no shell injection).
 * Returns stdout as string. Rejects on non-zero exit.
 */
function execGit(cwd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      ...opts,
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (d) => stdout.push(d));
    child.stderr.on('data', (d) => stderr.push(d));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(stdout).toString('utf8'));
      else reject(new Error((Buffer.concat(stderr).toString('utf8') || `exit code ${code}`).trim()));
    });
  });
}

async function isRepo(cwd) {
  try {
    await execGit(cwd, ['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

function parsePorcelain(out) {
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const xy = line.slice(0, 2);
      const rest = line.slice(3);
      let [a, b] = rest.split(' -> ');
      return {
        x: xy[0],
        y: xy[1],
        path: b || a,
        from: b ? a : null,
        staged: xy[0] !== ' ' && xy[0] !== '?',
        unstaged: xy[1] !== ' ',
        untracked: xy === '??',
      };
    });
}

function parseRemotes(out) {
  return out
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(\S+)\s+(\S+)\s+\((\w+)\)/);
      return m ? { name: m[1], url: m[2], dir: m[3] } : null;
    })
    .filter(Boolean);
}

export function registerGitRoutes(app, { rootDir }) {
  // ---- Status ----
  app.get('/api/git/status', async (req, res) => {
    try {
      const cwd = safeResolve(rootDir, req.query.cwd || '');
      if (!(await isRepo(cwd))) return res.json({ repo: false, cwd });

      const [statusRaw, branchRaw, remoteRaw] = await Promise.all([
        execGit(cwd, ['status', '--porcelain=v1']),
        execGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => ''),
        execGit(cwd, ['remote', '-v']).catch(() => ''),
      ]);

      let ahead = 0, behind = 0;
      try {
        const r = await execGit(cwd, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
        const m = r.trim().split('\t');
        ahead = Number(m[0]) || 0;
        behind = Number(m[1]) || 0;
      } catch {
        // No upstream configured — that's fine
      }

      res.json({
        repo: true,
        cwd,
        branch: branchRaw.trim(),
        ahead,
        behind,
        remote: parseRemotes(remoteRaw),
        files: parsePorcelain(statusRaw),
      });
    } catch (e) {
      sendError(res, e, 400);
    }
  });

  // ---- Log ----
  app.get('/api/git/log', async (req, res) => {
    try {
      const cwd = safeResolve(rootDir, req.query.cwd || '');
      if (!(await isRepo(cwd))) return res.json({ repo: false, commits: [] });

      const limit = Math.min(Number(req.query.limit) || 30, 200);
      const out = await execGit(cwd, [
        'log', `-n${limit}`, '--pretty=format:%H%x09%h%x09%an%x09%ae%x09%at%x09%s',
      ]);

      const commits = out
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [hash, short, name, email, ts, ...subj] = line.split('\t');
          return { hash, short, author: name, email, time: Number(ts) * 1000, subject: subj.join('\t') };
        });

      res.json({ repo: true, commits });
    } catch (e) {
      sendError(res, e, 400);
    }
  });

  // ---- Diff ----
  app.get('/api/git/diff', async (req, res) => {
    try {
      const filePath = req.query.path;
      if (!filePath) return res.status(400).json({ error: 'path required' });
      const cwd = safeResolve(rootDir, req.query.cwd || '');
      const staged = req.query.staged === '1';

      const args = ['diff'];
      if (staged) args.push('--staged');
      args.push('--', filePath);

      const out = await execGit(cwd, args);
      res.json({ diff: out });
    } catch (e) {
      sendError(res, e, 400);
    }
  });

  // ---- Stage ----
  app.post('/api/git/stage', async (req, res) => {
    try {
      const paths = req.body?.paths || [];
      if (!paths.length) return res.status(400).json({ error: 'paths required' });
      const cwd = safeResolve(rootDir, req.body?.cwd || '');
      await execGit(cwd, ['add', '--', ...paths]);
      res.json({ ok: true });
    } catch (e) {
      sendError(res, e, 400);
    }
  });

  // ---- Unstage ----
  app.post('/api/git/unstage', async (req, res) => {
    try {
      const paths = req.body?.paths || [];
      if (!paths.length) return res.status(400).json({ error: 'paths required' });
      const cwd = safeResolve(rootDir, req.body?.cwd || '');
      await execGit(cwd, ['reset', 'HEAD', '--', ...paths]);
      res.json({ ok: true });
    } catch (e) {
      sendError(res, e, 400);
    }
  });

  // ---- Discard ----
  app.post('/api/git/discard', async (req, res) => {
    try {
      const paths = req.body?.paths || [];
      if (!paths.length) return res.status(400).json({ error: 'paths required' });
      const cwd = safeResolve(rootDir, req.body?.cwd || '');
      await execGit(cwd, ['checkout', '--', ...paths]);
      res.json({ ok: true });
    } catch (e) {
      sendError(res, e, 400);
    }
  });

  // ---- Commit ----
  app.post('/api/git/commit', async (req, res) => {
    try {
      const cwd = safeResolve(rootDir, req.body?.cwd || '');
      const message = (req.body?.message || '').trim();
      if (!message) return res.status(400).json({ error: 'message required' });

      const out = await execGit(cwd, ['commit', '-m', message]);
      res.json({ ok: true, output: out });
    } catch (e) {
      sendError(res, e, 400);
    }
  });

  // ---- Pull ----
  app.post('/api/git/pull', async (req, res) => {
    try {
      const cwd = safeResolve(rootDir, req.body?.cwd || '');
      const out = await execGit(cwd, ['pull', '--ff-only']);
      res.json({ ok: true, output: out });
    } catch (e) {
      sendError(res, e, 400);
    }
  });

  // ---- Push ----
  app.post('/api/git/push', async (req, res) => {
    try {
      const cwd = safeResolve(rootDir, req.body?.cwd || '');
      const out = await execGit(cwd, ['push']);
      res.json({ ok: true, output: out });
    } catch (e) {
      sendError(res, e, 400);
    }
  });
}
