import { useEffect, useRef, useState } from 'preact/hooks';
import { io } from 'socket.io-client';
import { getToken } from '../api.js';

export function Logs({ notify }) {
  const [path, setPath] = useState('');
  const [running, setRunning] = useState(false);
  const [text, setText] = useState('');
  const [follow, setFollow] = useState(true);
  const sockRef = useRef(null);
  const preRef = useRef(null);

  const start = () => {
    if (!path) return;
    if (sockRef.current) sockRef.current.disconnect();
    setText('');
    const s = io('/logs', { transports: ['websocket', 'polling'], auth: { token: getToken() } });
    s.on('connect', () => s.emit('start', { path, tail: 200 }));
    s.on('started', ({ path: p }) => setText((t) => t + `\x1b[2m--- tailing ${p} ---\x1b[0m\n`));
    s.on('data', (d) => {
      setText((t) => {
        const next = t + d;
        return next.length > 500_000 ? next.slice(-400_000) : next;
      });
    });
    s.on('error', ({ message }) => notify(`Tail: ${message}`, 'error'));
    sockRef.current = s;
    setRunning(true);
  };

  const stop = () => {
    sockRef.current?.disconnect();
    sockRef.current = null;
    setRunning(false);
  };

  useEffect(() => {
    if (follow && preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [text, follow]);

  useEffect(() => () => sockRef.current?.disconnect(), []);

  return (
    <div class="logs-shell">
      <div class="proc-toolbar">
        <input
          class="input"
          placeholder="Path to a log file (e.g. /var/log/syslog or C:\\path\\to\\log.txt)"
          value={path}
          onInput={(e) => setPath(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && start()}
          style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace' }}
        />
        {running ? (
          <button class="btn danger" onClick={stop}><span class="material-symbols-outlined">stop</span> Stop</button>
        ) : (
          <button class="btn" onClick={start} style={{ background: 'var(--brand-500)', color: '#fff', borderColor: 'var(--brand-500)' }}>
            <span class="material-symbols-outlined">play_arrow</span> Tail
          </button>
        )}
        <label class="search-chk"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow</label>
        <button class="btn" onClick={() => setText('')} title="Clear">
          <span class="material-symbols-outlined">cleaning_services</span>
        </button>
      </div>
      <pre ref={preRef} class="logs-output">{text || (running ? 'Waiting for output…' : 'Enter a file path and press Tail to start.')}</pre>
    </div>
  );
}
