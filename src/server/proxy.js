import net from 'node:net';
import http from 'node:http';
import path from 'node:path';

function probe(port, timeoutMs = 200) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (v) => { if (!done) { done = true; sock.destroy(); resolve(v); } };
    sock.setTimeout(timeoutMs);
    sock.once('connect', () => finish(true));
    sock.once('timeout', () => finish(false));
    sock.once('error', () => finish(false));
    sock.connect(port, '127.0.0.1');
  });
}

const COMMON_PORTS = [3000, 3001, 3030, 3333, 4000, 4173, 4200, 5000, 5173, 5500, 5555, 6006, 7000, 7777, 8000, 8080, 8081, 8088, 8888, 9000, 9090];

export function registerProxyRoutes(app, { selfPort }) {
  app.get('/api/sites', async (_req, res) => {
    const checks = await Promise.all(
      COMMON_PORTS.filter((p) => p !== selfPort).map(async (p) => ({ port: p, alive: await probe(p) }))
    );
    res.json({ sites: checks.filter((c) => c.alive) });
  });

  app.use('/proxy/:port', (req, res) => {
    const port = Number(req.params.port);
    if (!port || port < 1 || port > 65535 || port === selfPort) {
      res.status(400).send('invalid port');
      return;
    }
    if (port === Number(process.env.PORT) || (port < 1024 && port !== 80 && port !== 443)) {
      // allow but warn-only
    }
    const targetPath = req.url || '/';
    const reqOpts = {
      hostname: '127.0.0.1',
      port,
      path: targetPath,
      method: req.method,
      headers: { ...req.headers, host: `127.0.0.1:${port}` },
    };
    const upstream = http.request(reqOpts, (upRes) => {
      const headers = { ...upRes.headers };
      const ct = headers['content-type'] || '';
      if (ct.includes('text/html')) {
        const chunks = [];
        upRes.on('data', (c) => chunks.push(c));
        upRes.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          const base = `/proxy/${port}/`;
          const rewritten = body.replace(/(href|src|action)=(['\"])\/(?!\/)/g, `$1=$2${base}`);
          delete headers['content-length'];
          res.writeHead(upRes.statusCode || 200, headers);
          res.end(rewritten);
        });
      } else {
        res.writeHead(upRes.statusCode || 200, headers);
        upRes.pipe(res);
      }
    });
    upstream.on('error', (err) => {
      res.status(502).send(`proxy error: ${err.message}`);
    });
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      req.pipe(upstream);
    } else {
      upstream.end();
    }
  });
}
