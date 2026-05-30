import os from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import chalk from 'chalk';

const requireCJS = createRequire(typeof __filename !== 'undefined' ? __filename : import.meta.url);
let ptyMod = null;
try {
  ptyMod = requireCJS('node-pty');
} catch (err) {
  console.log(chalk.yellow('\u26a0'), `node-pty unavailable (${err.message?.split('\n')[0] || 'unknown'}) — using child_process fallback`);
}

const isWindows = process.platform === 'win32';

function defaultShell() {
  if (process.env.MTERMIUS_SHELL) return process.env.MTERMIUS_SHELL;
  if (isWindows) {
    const sysRoot = process.env.SystemRoot || 'C:\\Windows';
    // 32-bit Node.js on 64-bit Windows needs Sysnative to reach native System32
    const isWow64 = !!process.env.PROCESSOR_ARCHITEW6432;
    const sysDir = isWow64
      ? path.join(sysRoot, 'Sysnative')
      : path.join(sysRoot, 'System32');

    // 1. Try pwsh (PowerShell Core 7+) — PATH search
    try {
      const pwsh = path.join(sysDir, 'windowspowershell', 'v1.0', 'powershell.exe');
      if (require('node:fs').existsSync(pwsh)) return pwsh;
    } catch {}

    // 2. Try Windows PowerShell 5.1
    const psPath = path.join(sysDir, 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    try {
      if (require('node:fs').existsSync(psPath)) return psPath;
    } catch {}

    // 3. Try pwsh.exe from PATH
    try {
      const { spawnSync } = require('node:child_process');
      const r = spawnSync('where', ['pwsh.exe'], { timeout: 2000, windowsHide: true });
      if (r.status === 0 && r.stdout.length > 0) {
        const pwshPath = r.stdout.toString('utf8').trim().split('\n')[0].trim();
        if (require('node:fs').existsSync(pwshPath)) return pwshPath;
      }
    } catch {}

    // 4. Fallback to cmd.exe
    return process.env.COMSPEC || path.join(sysRoot, 'System32', 'cmd.exe');
  }
  return process.env.SHELL || '/bin/bash';
}

import path from 'node:path';

function spawnPty({ shell, cols, rows, cwd, env }) {
  if (ptyMod && ptyMod.spawn) {
    const shellName = path.basename(shell, path.extname(shell));
    return ptyMod.spawn(shell, isWindows ? [] : ['-l'], {
      name: shellName.toLowerCase().includes('cmd') ? 'cmd' : 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: cwd || os.homedir(),
      env: { ...env, TERM: 'xterm-256color' },
    });
  }

  // ---- Fallback: child_process.spawn ----
  const shellBasename = path.basename(shell).toLowerCase();
  let args = [];
  const spawnOpts = { cwd: cwd || os.homedir(), env, shell: true, windowsHide: true };

  if (isWindows) {
    if (shellBasename.includes('cmd')) {
      // CMD: interactive mode with delayed expansion enabled
      args = ['/Q', '/V:ON'];
      spawnOpts.shell = false;
    } else if (shellBasename.includes('powershell') || shellBasename.includes('pwsh')) {
      // PowerShell: interactive with no logo, no exit
      args = ['-NoLogo', '-NoExit', '-Command', '-'];
      spawnOpts.shell = false;
    } else {
      // WSL, bash, etc.
      args = ['-i'];
      spawnOpts.shell = false;
    }
  } else {
    // Unix: login shell for interactive mode
    args = ['-l'];
  }

  const cp = spawn(shell, args, spawnOpts);

  cp.on('error', () => {
    // Handled by onExit callback below
  });

  let killed = false;
  return {
    onData: (cb) => {
      cp.stdout.on('data', (d) => cb(d.toString('utf8')));
      cp.stderr.on('data', (d) => cb(d.toString('utf8')));
    },
    onExit: (cb) => {
      cp.on('exit', (code, signal) => {
        if (!killed) cb({ exitCode: code, signal });
      });
      cp.on('error', () => {
        if (!killed) cb({ exitCode: 1, signal: 'ERR' });
      });
    },
    write: (data) => {
      try {
        const ok = cp.stdin.write(data);
        // Handle backpressure: if write returns false, wait for drain
        if (!ok) {
          cp.stdin.once('drain', () => {});
        }
      } catch (err) {
        // Stdin may be closed if process exited
      }
    },
    resize: () => {
      // Terminal resize not supported in fallback mode.
      // The shell sessions up to standard 80x24; user can run `stty rows N cols N` on Unix.
    },
    kill: () => {
      killed = true;
      try { cp.kill(); } catch {}
    },
    pid: cp.pid,
  };
}

export function attachPty(io, { rootDir }) {
  const term = io.of('/term');

  term.on('connection', (socket) => {
    let ptyInstance = null;

    socket.on('start', ({ cols, rows, cwd } = {}) => {
      if (ptyInstance) {
        socket.emit('error', { message: 'session already started' });
        return;
      }
      const shell = defaultShell();
      const useCwd = cwd && typeof cwd === 'string' ? cwd : rootDir;
      const shellEnv = { ...process.env, TERM: 'xterm-256color', M_TERMIUS: '1' };

      try {
        ptyInstance = spawnPty({
          shell,
          cols: cols || 80,
          rows: rows || 24,
          cwd: useCwd,
          env: shellEnv,
        });

        socket.emit('started', {
          pid: ptyInstance.pid,
          shell,
          cwd: useCwd,
          nodePty: !!(ptyMod?.spawn),
        });

        ptyInstance.onData((d) => {
          if (socket.connected) socket.emit('data', d);
        });

        ptyInstance.onExit(({ exitCode, signal }) => {
          const msg = signal
            ? `\r\n\x1b[33m[process terminated by signal ${signal}]\x1b[0m`
            : `\r\n\x1b[33m[process exited with code ${exitCode}]\x1b[0m`;
          if (socket.connected) {
            socket.emit('data', msg);
            socket.emit('exit', { exitCode, signal });
          }
        });
      } catch (err) {
        socket.emit('error', { message: `Failed to start shell: ${err.message}` });
      }
    });

    socket.on('input', (data) => {
      if (ptyInstance && data) {
        ptyInstance.write(data);
      }
    });

    socket.on('resize', ({ cols, rows }) => {
      if (ptyInstance) {
        try { ptyInstance.resize(cols, rows); } catch {}
      }
    });

    socket.on('disconnect', () => {
      if (ptyInstance) {
        try { ptyInstance.kill(); } catch {}
        ptyInstance = null;
      }
    });
  });
}
