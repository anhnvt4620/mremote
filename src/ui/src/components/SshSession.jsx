import { useEffect, useRef, useState } from 'preact/hooks';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { io } from 'socket.io-client';
import { getToken } from '../api.js';
import { TERMINAL_THEMES } from './terminal-themes.js';

export function SshSession({ host, onStatusChange }) {
  const hostRef = useRef(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const theme = TERMINAL_THEMES.default;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: '"JetBrains Mono", Menlo, Monaco, Consolas, monospace',
      theme: { ...theme, cursorAccent: theme.background },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(hostRef.current);
    fit.fit();
    requestAnimationFrame(() => term.focus());

    // Click-to-focus
    const hostEl = hostRef.current;
    const onHostClick = () => term.focus();
    hostEl?.addEventListener('click', onHostClick);

    const socket = io('/ssh', {
      transports: ['websocket', 'polling'],
      auth: { token: getToken() },
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      setStatus('connecting');
      term.writeln(`\x1b[36mConnecting to ${host.user}@${host.host}:${host.port}...\x1b[0m`);
      socket.emit('connect-host', { id: host.id, cols: term.cols, rows: term.rows });
    });

    socket.on('connect_error', (err) => {
      setStatus('error');
      onStatusChange?.('error');
      term.writeln(`\r\n\x1b[31m[SSH connection failed: ${err.message}]\x1b[0m`);
    });

    socket.on('connected', ({ host: h }) => {
      setStatus('connected');
      onStatusChange?.('connected');
      term.writeln(`\x1b[32m\u2713 Connected as ${h}\x1b[0m`);
      term.writeln('');
      term.focus();
    });

    socket.on('data', (d) => { if (d) term.write(d); });
    socket.on('error', ({ message }) => term.writeln(`\r\n\x1b[31m[Error: ${message}]\x1b[0m`));
    socket.on('exit', ({ exitCode }) => {
      setStatus('exited');
      onStatusChange?.('exited');
      term.writeln(`\r\n\x1b[33m[SSH session ended - code ${exitCode ?? '?'}]\x1b[0m`);
    });

    term.onData((d) => socket.emit('input', d));
    term.onResize(({ cols, rows }) => socket.emit('resize', { cols, rows }));

    const ro = new ResizeObserver(() => { try { fit.fit(); } catch {} });
    ro.observe(hostRef.current);
    const onResize = () => { try { fit.fit(); } catch {} };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      hostEl?.removeEventListener('click', onHostClick);
      socket.disconnect();
      term.dispose();
    };
  }, [host.id]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div class="terminal-host" ref={hostRef} />
      <div class="term-status">
        <span class="term-status-item">
          <span class={`term-status-dot ${status}`} />
          {status === 'connected' ? host.label || `${host.user}@${host.host}` : status}
        </span>
        <span style={{ flex: 1 }} />
        <span class="term-status-item">{host.host}:{host.port}</span>
      </div>
    </div>
  );
}
