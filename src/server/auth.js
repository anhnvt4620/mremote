import { loadJson, saveJson, randomToken, randomDigits } from './utils.js';

const TOKEN_FILE = 'tokens.json';

function loadStore() {
  return loadJson(TOKEN_FILE, { devices: {}, pairing: null });
}

function saveStore(store) {
  saveJson(TOKEN_FILE, store);
}

export function createAuth({ enabled = true } = {}) {
  const store = loadStore();
  let pairing = null;

  function rotatePairing() {
    pairing = {
      code: randomDigits(100000, 1000000),
      key: randomToken(24),
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000,
    };
    return pairing;
  }
  rotatePairing();

  function pairingActive() {
    return pairing && Date.now() < pairing.expiresAt;
  }

  function consumePairing(code, deviceLabel) {
    if (!pairingActive()) return null;
    if (code !== pairing.code && code !== pairing.key) return null;
    const token = randomToken(32);
    const id = randomToken(8);
    store.devices[id] = {
      id,
      label: deviceLabel || 'unnamed device',
      token,
      pairedAt: Date.now(),
      lastSeen: Date.now(),
    };
    saveStore(store);
    rotatePairing();
    return { token, deviceId: id, label: store.devices[id].label };
  }

  function tokenValid(token) {
    if (!enabled) return true;
    if (!token) return false;
    for (const d of Object.values(store.devices)) {
      if (d.token === token) {
        d.lastSeen = Date.now();
        saveStore(store);
        return true;
      }
    }
    return false;
  }

  function listDevices() {
    return Object.values(store.devices).map((d) => ({
      id: d.id,
      label: d.label,
      pairedAt: d.pairedAt,
      lastSeen: d.lastSeen,
    }));
  }

  function revoke(id) {
    if (store.devices[id]) {
      delete store.devices[id];
      saveStore(store);
      return true;
    }
    return false;
  }

  function extractToken(req) {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) return auth.slice(7);
    if (req.query?.token) return String(req.query.token);
    if (req.headers['x-mt-token']) return String(req.headers['x-mt-token']);
    return null;
  }

  function httpMiddleware(req, res, next) {
    if (!enabled) return next();
    if (
      req.path === '/api/health' ||
      req.path.startsWith('/api/auth/') ||
      req.path === '/pair' ||
      req.path === '/'
    ) return next();
    const token = extractToken(req);
    if (tokenValid(token)) return next();
    res.status(401).json({ error: 'unauthorized' });
  }

  function socketMiddleware(socket, next) {
    if (!enabled) return next();
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      socket.handshake.headers?.['x-mt-token'];
    if (tokenValid(token)) return next();
    next(new Error('unauthorized'));
  }

  return {
    enabled,
    rotatePairing,
    getPairing: () => (pairingActive() ? pairing : rotatePairing()),
    consumePairing,
    tokenValid,
    listDevices,
    revoke,
    httpMiddleware,
    socketMiddleware,
  };
}
