import { loadJson, saveJson, sendError } from './utils.js';

const FILE = 'config.json';

const DEFAULTS = {
  defaultShell: '',
  defaultCwd: '',
  fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
  fontSize: 13,
  cursorStyle: 'bar',
  cursorBlink: true,
  terminalTheme: 'default',
  enableTunnel: true,
  enableAuth: true,
};

function load() {
  return { ...DEFAULTS, ...loadJson(FILE, {}) };
}

function save(cfg) {
  saveJson(FILE, cfg);
}

export function getSettings() {
  return load();
}

export function registerSettingsRoutes(app, _ctx) {
  app.get('/api/settings', (_req, res) => {
    res.json(load());
  });

  app.post('/api/settings', (req, res) => {
    try {
      const next = load();
      for (const [k, v] of Object.entries(req.body || {})) {
        if (k in DEFAULTS) next[k] = v;
      }
      save(next);
      res.json(next);
    } catch (err) {
      sendError(res, err, 500);
    }
  });

  app.post('/api/settings/reset', (_req, res) => {
    try {
      save({ ...DEFAULTS });
      res.json({ ...DEFAULTS });
    } catch (err) {
      sendError(res, err, 500);
    }
  });
}
