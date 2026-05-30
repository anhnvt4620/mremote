import fs from 'node:fs';
import { safeResolve } from './utils.js';

export function attachLogs(io, { rootDir }) {
  const ns = io.of('/logs');
  ns.on('connection', (socket) => {
    let watcher = null;
    let filePath = null;
    let lastSize = 0;

    const cleanup = () => {
      try { watcher && fs.unwatchFile(filePath); } catch {}
      watcher = null;
      filePath = null;
      lastSize = 0;
    };

    socket.on('start', async ({ path: rawPath, tail = 200 } = {}) => {
      cleanup();
      try {
        filePath = safeResolve(rootDir, rawPath || '');
        const st = fs.statSync(filePath);
        if (st.isDirectory()) throw new Error('cannot tail a directory');
        socket.emit('started', { path: filePath, size: st.size });

        // Read initial tail
        const fd = fs.openSync(filePath, 'r');
        const initialBytes = Math.min(st.size, tail * 200);
        const startPos = Math.max(0, st.size - initialBytes);
        const buf = Buffer.alloc(initialBytes);
        if (initialBytes > 0) {
          fs.readSync(fd, buf, 0, initialBytes, startPos);
          let text = buf.toString('utf8');
          if (startPos > 0) {
            const nl = text.indexOf('\n');
            if (nl >= 0) text = text.slice(nl + 1);
          }
          if (text) socket.emit('data', text);
        }
        fs.closeSync(fd);
        lastSize = st.size;

        // Watch for changes
        const onChange = (curr, prev) => {
          if (curr.size === prev.size && curr.mtimeMs === prev.mtimeMs) return;
          if (curr.size < lastSize) {
            socket.emit('data', `\n--- file truncated/rotated ---\n`);
            lastSize = 0;
          }
          const remaining = curr.size - lastSize;
          if (remaining <= 0) return;
          const fd2 = fs.openSync(filePath, 'r');
          const buf2 = Buffer.alloc(Math.min(remaining, 1024 * 1024));
          fs.readSync(fd2, buf2, 0, buf2.length, lastSize);
          fs.closeSync(fd2);
          socket.emit('data', buf2.toString('utf8'));
          lastSize += buf2.length;
        };
        fs.watchFile(filePath, { interval: 600 }, onChange);
        watcher = onChange;
      } catch (err) {
        socket.emit('error', { message: err.message });
        cleanup();
      }
    });

    socket.on('disconnect', cleanup);
    socket.on('stop', cleanup);
  });
}
