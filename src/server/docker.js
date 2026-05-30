import { execCommand, sendError } from './utils.js';

let dockerAvailable = null;
async function checkDocker() {
  if (dockerAvailable !== null) return dockerAvailable;
  try {
    await execCommand('docker', ['version', '--format', '{{.Server.Version}}']);
    dockerAvailable = true;
  } catch {
    dockerAvailable = false;
  }
  return dockerAvailable;
}

function parseJsonLines(out) {
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

export function registerDockerRoutes(app, _ctx) {
  app.get('/api/docker/status', async (_req, res) => {
    const ok = await checkDocker();
    res.json({ available: ok });
  });

  app.get('/api/docker/containers', async (_req, res) => {
    if (!(await checkDocker())) return res.status(503).json({ error: 'docker not available' });
    try {
      const out = await execCommand('docker', ['ps', '-a', '--format', '{{json .}}']);
      const items = parseJsonLines(out).map((c) => ({
        id: c.ID,
        name: c.Names,
        image: c.Image,
        status: c.Status,
        state: c.State,
        ports: c.Ports,
        created: c.CreatedAt,
        size: c.Size,
      }));
      res.json({ items });
    } catch (e) {
      sendError(res, e, 500);
    }
  });

  app.get('/api/docker/images', async (_req, res) => {
    if (!(await checkDocker())) return res.status(503).json({ error: 'docker not available' });
    try {
      const out = await execCommand('docker', ['images', '--format', '{{json .}}']);
      const items = parseJsonLines(out).map((i) => ({
        id: i.ID,
        repo: i.Repository,
        tag: i.Tag,
        size: i.Size,
        created: i.CreatedSince,
      }));
      res.json({ items });
    } catch (e) {
      sendError(res, e, 500);
    }
  });

  // Container lifecycle actions
  for (const action of ['start', 'stop', 'restart', 'kill']) {
    app.post(`/api/docker/${action}/:id`, async (req, res) => {
      if (!(await checkDocker())) return res.status(503).json({ error: 'docker not available' });
      try {
        await execCommand('docker', [action, req.params.id]);
        res.json({ ok: true });
      } catch (e) {
        sendError(res, e, 400);
      }
    });
  }

  app.delete('/api/docker/rm/:id', async (req, res) => {
    if (!(await checkDocker())) return res.status(503).json({ error: 'docker not available' });
    try {
      await execCommand('docker', ['rm', '-f', req.params.id]);
      res.json({ ok: true });
    } catch (e) {
      sendError(res, e, 400);
    }
  });

  app.get('/api/docker/logs/:id', async (req, res) => {
    if (!(await checkDocker())) return res.status(503).json({ error: 'docker not available' });
    const tail = Math.min(Number(req.query.tail) || 200, 2000);
    try {
      const out = await execCommand('docker', ['logs', '--tail', String(tail), req.params.id]);
      res.json({ logs: out });
    } catch (e) {
      sendError(res, e, 400);
    }
  });
}
