import { loadJson, saveJson, randomToken, sendError } from './utils.js';

const FILE = 'snippets.json';

const SAMPLE = [
  { name: 'Disk usage', value: 'df -h' },
  { name: 'Top mem processes', value: 'ps aux --sort=-%mem | head -n 15' },
  {
    name: 'Show ports',
    value: process.platform === 'win32'
      ? 'Get-NetTCPConnection -State Listen | Format-Table'
      : 'ss -tlnp',
  },
  { name: 'Tail nginx', value: 'tail -f /var/log/nginx/access.log' },
];

function seedDefaults() {
  return SAMPLE.map((s) => ({ id: randomToken(4), ...s }));
}

function load() {
  return loadJson(FILE, seedDefaults);
}

function save(items) {
  saveJson(FILE, items);
}

export function registerSnippetRoutes(app, _ctx) {
  app.get('/api/snippets', (_req, res) => {
    res.json({ items: load() });
  });

  app.post('/api/snippets', (req, res) => {
    try {
      const items = load();
      const b = req.body || {};
      if (!b.name || !b.value) return res.status(400).json({ error: 'name and value required' });
      const next = {
        id: b.id || randomToken(4),
        name: String(b.name).slice(0, 80),
        value: String(b.value),
      };
      const idx = items.findIndex((x) => x.id === next.id);
      if (idx >= 0) items[idx] = next;
      else items.push(next);
      save(items);
      res.json(next);
    } catch (err) {
      sendError(res, err, 500);
    }
  });

  app.delete('/api/snippets/:id', (req, res) => {
    try {
      const items = load();
      const next = items.filter((x) => x.id !== req.params.id);
      if (next.length === items.length) return res.status(404).json({ error: 'not found' });
      save(next);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err, 500);
    }
  });
}
