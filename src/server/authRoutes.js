export function registerAuthRoutes(app, { auth }) {
  app.get('/api/auth/status', (req, res) => {
    const token =
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
      req.query.token ||
      req.headers['x-mt-token'] ||
      null;
    res.json({
      enabled: auth.enabled,
      authenticated: auth.tokenValid(token),
    });
  });

  app.get('/api/auth/pairing', (_req, res) => {
    const p = auth.getPairing();
    res.json({
      code: p.code,
      key: p.key,
      expiresAt: p.expiresAt,
    });
  });

  app.post('/api/auth/pair', (req, res) => {
    const { code, label } = req.body || {};
    const result = auth.consumePairing(code, label);
    if (!result) return res.status(400).json({ error: 'invalid or expired code' });
    res.json(result);
  });

  app.get('/api/auth/devices', (req, res) => {
    const token =
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
      req.query.token ||
      null;
    if (auth.enabled && !auth.tokenValid(token)) return res.status(401).json({ error: 'unauthorized' });
    res.json({ devices: auth.listDevices() });
  });

  app.delete('/api/auth/devices/:id', (req, res) => {
    const token =
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
      req.query.token ||
      null;
    if (auth.enabled && !auth.tokenValid(token)) return res.status(401).json({ error: 'unauthorized' });
    if (auth.revoke(req.params.id)) res.json({ ok: true });
    else res.status(404).json({ error: 'not found' });
  });
}
