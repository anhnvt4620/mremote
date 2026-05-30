import { exec, spawn } from 'node:child_process';
import { sendError } from './utils.js';

const isWindows = process.platform === 'win32';

function execAsync(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 16 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout);
    });
  });
}

async function listWindows() {
  const cmd = `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId, Name, WorkingSetSize, ParentProcessId, CommandLine | ConvertTo-Json -Compress"`;
  const out = await execAsync(cmd);
  let parsed;
  try { parsed = JSON.parse(out); } catch { return []; }
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr
    .filter((p) => p && p.ProcessId)
    .map((p) => ({
      pid: p.ProcessId,
      name: p.Name || '',
      mem: Number(p.WorkingSetSize) || 0,
      cpu: 0,
      ppid: p.ParentProcessId || 0,
      cmd: p.CommandLine || p.Name || '',
    }));
}

async function listUnix() {
  const out = await execAsync('ps -eo pid,ppid,pcpu,rss,comm,args');
  const lines = out.split('\n').slice(1);
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split(/\s+/);
      const pid = Number(parts[0]);
      const ppid = Number(parts[1]);
      const cpu = Number(parts[2]) || 0;
      const rss = Number(parts[3]) || 0;
      const name = parts[4] || '';
      const cmd = parts.slice(5).join(' ') || name;
      return { pid, ppid, cpu, mem: rss * 1024, name, cmd };
    });
}

/**
 * Kill a process cross-platform.
 * On Windows, uses `taskkill` which works for any process owned by the same user.
 * On Unix, uses `process.kill` with SIGTERM.
 */
function killProcess(pid) {
  return new Promise((resolve, reject) => {
    if (isWindows) {
      const child = spawn('taskkill', ['/PID', String(pid), '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      child.on('close', (code) => {
        // code 0 = success, code 128 = process not found (already dead)
        if (code === 0 || code === 128) resolve();
        else reject(new Error(`taskkill exited with code ${code}`));
      });
      child.on('error', reject);
    } else {
      try {
        process.kill(pid, 'SIGTERM');
        resolve();
      } catch (err) {
        reject(err);
      }
    }
  });
}

export function registerProcessRoutes(app, _ctx) {
  app.get('/api/processes', async (req, res) => {
    try {
      const items = isWindows ? await listWindows() : await listUnix();
      const sortBy = req.query.sort || 'mem';
      items.sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
      const limit = Math.min(Number(req.query.limit) || 200, 500);
      res.json({ count: items.length, items: items.slice(0, limit) });
    } catch (err) {
      sendError(res, err, 500);
    }
  });

  app.delete('/api/processes/:pid', async (req, res) => {
    const pid = Number(req.params.pid);
    if (!pid || pid < 1) return res.status(400).json({ error: 'invalid pid' });
    try {
      await killProcess(pid);
      res.json({ ok: true });
    } catch (err) {
      sendError(res, err, 400);
    }
  });
}
