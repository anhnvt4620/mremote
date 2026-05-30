import http from 'node:http';
import https from 'node:https';

function fetchOnce(url, opts) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https://') ? https : http;
    const startedAt = Date.now();
    const req = lib.request(url, opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        const ct = res.headers['content-type'] || '';
        let text = null;
        let isBinary = false;
        if (body.length < 2 * 1024 * 1024 && !body.subarray(0, 4096).includes(0)) {
          text = body.toString('utf8');
        } else {
          isBinary = true;
        }
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage || '',
          headers: res.headers,
          ms: Date.now() - startedAt,
          size: body.length,
          binary: isBinary,
          body: text,
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(new Error('timeout')); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

export function registerHttpClientRoutes(app, _ctx) {
  app.post('/api/http', async (req, res) => {
    const b = req.body || {};
    if (!b.url || typeof b.url !== 'string') return res.status(400).json({ error: 'url required' });
    if (!/^https?:\/\//i.test(b.url)) return res.status(400).json({ error: 'http(s) only' });
    try {
      const url = new URL(b.url);
      const method = (b.method || 'GET').toUpperCase();
      const headers = { ...(b.headers || {}) };
      let body = null;
      if (b.body && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        body = typeof b.body === 'string' ? b.body : JSON.stringify(b.body);
        if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
          headers['Content-Type'] = 'application/json';
        }
        headers['Content-Length'] = Buffer.byteLength(body);
      }
      const opts = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers,
        body,
      };
      const result = await fetchOnce(b.url, opts);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
