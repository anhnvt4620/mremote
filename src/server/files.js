import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import mime from 'mime-types';
import { safeResolve, sendError } from './utils.js';

const MAX_PREVIEW = 2 * 1024 * 1024; // 2 MB

async function safeStat(p) {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

export function registerFileRoutes(app, { rootDir }) {
  // ---- List directory ----
  app.get('/api/fs/list', async (req, res) => {
    try {
      const target = safeResolve(rootDir, req.query.path || '');
      const entries = await fs.readdir(target, { withFileTypes: true });
      const items = await Promise.all(
        entries.map(async (e) => {
          const full = path.join(target, e.name);
          const st = await safeStat(full);
          return {
            name: e.name,
            path: full,
            isDir: e.isDirectory(),
            size: st?.size ?? 0,
            mtime: st?.mtimeMs ?? 0,
          };
        })
      );
      items.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
      res.json({
        cwd: target,
        parent: path.dirname(target) === target ? null : path.dirname(target),
        items,
      });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  // ---- Read file ----
  app.get('/api/fs/read', async (req, res) => {
    try {
      const target = safeResolve(rootDir, req.query.path || '');
      const st = await fs.stat(target);
      if (st.isDirectory()) return res.status(400).json({ error: 'is a directory' });
      if (st.size > MAX_PREVIEW) return res.status(413).json({ error: 'file too large for preview' });
      const data = await fs.readFile(target);
      const looksBinary = data.subarray(0, 8000).includes(0);
      res.json({
        path: target,
        size: st.size,
        binary: looksBinary,
        content: looksBinary ? null : data.toString('utf8'),
      });
    } catch (err) {
      sendError(res, err, 404);
    }
  });

  // ---- Write file ----
  app.post('/api/fs/write', async (req, res) => {
    try {
      const { path: p, content } = req.body || {};
      if (!p) return res.status(400).json({ error: 'path required' });
      const target = safeResolve(rootDir, p);
      await fs.writeFile(target, content ?? '', 'utf8');
      res.json({ ok: true, path: target });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  // ---- Create directory ----
  app.post('/api/fs/mkdir', async (req, res) => {
    try {
      const { path: p } = req.body || {};
      if (!p) return res.status(400).json({ error: 'path required' });
      const target = safeResolve(rootDir, p);
      await fs.mkdir(target, { recursive: true });
      res.json({ ok: true, path: target });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  // ---- Delete file/directory ----
  app.delete('/api/fs/delete', async (req, res) => {
    try {
      const target = safeResolve(rootDir, req.query.path || '');
      if (target === rootDir) return res.status(403).json({ error: 'cannot delete root directory' });
      const st = await fs.stat(target);
      if (st.isDirectory()) await fs.rm(target, { recursive: true, force: true });
      else await fs.unlink(target);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  // ---- Rename file/directory ----
  app.post('/api/fs/rename', async (req, res) => {
    try {
      const { from, to } = req.body || {};
      if (!from || !to) return res.status(400).json({ error: 'from and to required' });
      await fs.rename(safeResolve(rootDir, from), safeResolve(rootDir, to));
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err, 400);
    }
  });

  // ---- Download file ----
  app.get('/api/fs/download', async (req, res) => {
    try {
      const target = safeResolve(rootDir, req.query.path || '');
      const st = await fs.stat(target);
      if (st.isDirectory()) return res.status(400).json({ error: 'is a directory' });
      const type = mime.lookup(target) || 'application/octet-stream';
      res.setHeader('Content-Type', type);
      res.setHeader('Content-Disposition', `attachment; filename="${path.basename(target)}"`);
      res.setHeader('Content-Length', st.size);
      createReadStream(target).pipe(res);
    } catch (err) {
      sendError(res, err, 404);
    }
  });

  // ---- Upload file(s) ----
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, _file, cb) => {
        try {
          const dest = safeResolve(rootDir, req.query.dir || '');
          cb(null, dest);
        } catch (err) {
          cb(err);
        }
      },
      filename: (_req, file, cb) => cb(null, file.originalname),
    }),
    limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB
  });

  app.post('/api/fs/upload', upload.array('files'), (req, res) => {
    res.json({ ok: true, count: req.files?.length || 0 });
  });
}
