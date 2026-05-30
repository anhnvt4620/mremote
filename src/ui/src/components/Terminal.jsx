import { useEffect, useRef, useState } from 'preact/hooks';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { io } from 'socket.io-client';
import { getToken, apiJson } from '../api.js';
import { TERMINAL_THEMES, THEME_LABELS } from './terminal-themes.js';

function TerminalSession({ sessionId, settings, onReady }) {
  const hostRef = useRef(null);
  const sockRef = useRef(null);
  const termRef = useRef(null);
  const themeRef = useRef(null);
  const [status, setStatus] = useState('connecting');
  const [shellInfo, setShellInfo] = useState(null);

  useEffect(() => {
    const themeName = settings?.terminalTheme || 'default';
    const theme = TERMINAL_THEMES[themeName] || TERMINAL_THEMES.default;
    themeRef.current = theme;

    const term = new XTerm({
      cursorBlink: settings?.cursorBlink ?? true,
      cursorStyle: settings?.cursorStyle || 'bar',
      fontSize: settings?.fontSize || 13,
      fontFamily: settings?.fontFamily || '"JetBrains Mono", Menlo, Monaco, Consolas, monospace',
      theme: {
        ...theme,
        cursorAccent: theme.background,
      },
      allowProposedApi: true,
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(hostRef.current);
    fit.fit();
    termRef.current = term;

    requestAnimationFrame(() => term.focus());

    const hostEl = hostRef.current;
    const onHostClick = () => term.focus();
    hostEl?.addEventListener('click', onHostClick);

    const socket = io('/term', {
      transports: ['websocket', 'polling'],
      auth: { token: getToken() },
      reconnectionAttempts: 5,
      reconnectionDelay: 800,
    });
    sockRef.current = socket;

    onReady?.({
      send: (s) => { if (socket.connected) socket.emit('input', s); },
      focus: () => term.focus(),
    });

    socket.on('connect', () => {
      setStatus('starting');
      socket.emit('start', { cols: term.cols, rows: term.rows });
    });

    socket.on('connect_error', (err) => {
      setStatus('error');
      term.writeln(`\r\n\x1b[31m[Connection error: ${err.message}]\x1b[0m`);
      term.writeln(`\x1b[33m[Verify the server is running and auth is valid]\x1b[0m`);
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        setStatus('disconnected');
        term.writeln(`\r\n\x1b[33m[Server disconnected - reconnecting...]\x1b[0m`);
      }
    });

    socket.on('reconnect', () => {
      setStatus('starting');
      socket.emit('start', { cols: term.cols, rows: term.rows });
    });

    socket.on('started', ({ shell, pid, nodePty }) => {
      setStatus('running');
      setShellInfo({ shell, pid, nodePty });
      term.writeln(`\x1b[38;2;230;138;110m\u25b6 M-Termius\x1b[0m  ${sessionId}`);
      term.writeln(`  Shell: \x1b[36m${shell}\x1b[0m  PID: \x1b[2m${pid}\x1b[0m${nodePty ? '' : ' \x1b[33m(fallback)\x1b[0m'}`);
      term.writeln('');
      term.focus();
    });

    socket.on('data', (d) => { if (termRef.current) term.write(d); });

    socket.on('exit', ({ exitCode, signal }) => {
      setStatus('exited');
      const cause = signal ? `signal ${signal}` : `code ${exitCode}`;
      term.writeln(`\r\n\x1b[33m[Process exited - ${cause}]\x1b[0m`);
      term.writeln(`\x1b[2m  New session? Press Enter or click + New Tab\x1b[0m`);
    });

    socket.on('error', ({ message }) => {
      term.writeln(`\r\n\x1b[31m[Error: ${message}]\x1b[0m`);
    });

    term.onData((d) => socket.emit('input', d));
    term.onResize(({ cols, rows }) => socket.emit('resize', { cols, rows }));

    const onResize = () => { try { fit.fit(); } catch {} };
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(hostRef.current);

    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      hostEl?.removeEventListener('click', onHostClick);
      socket.disconnect();
      term.dispose();
    };
  }, [sessionId]);

  // Update xterm theme when settings change
  useEffect(() => {
    if (!termRef.current) return;
    const themeName = settings?.terminalTheme || 'default';
    const theme = TERMINAL_THEMES[themeName] || TERMINAL_THEMES.default;
    if (themeRef.current !== theme) {
      themeRef.current = theme;
      try {
        termRef.current.options.theme = { ...theme, cursorAccent: theme.background };
      } catch {}
    }
  }, [settings?.terminalTheme]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div class="terminal-host" ref={hostRef} />
      <div class="term-status">
        <span class="term-status-item">
          <span class={`term-status-dot ${status}`} />
          {status === 'running' ? sessionId : status}
        </span>
        {shellInfo && (
          <span class="term-status-item">{shellInfo.shell?.split(/[/\\]/).pop()}{shellInfo.nodePty ? '' : ' (fallback)'}</span>
        )}
        {settings?.terminalTheme && settings.terminalTheme !== 'default' && (
          <span class="term-status-item" style={{ opacity: 0.6 }}>{THEME_LABELS[settings.terminalTheme]}</span>
        )}
      </div>
    </div>
  );
}

export function Terminal({ notify }) {
  const [tabs, setTabs] = useState([{ id: 1, label: 'Shell 1' }]);
  const [active, setActive] = useState(1);
  const [nextId, setNextId] = useState(2);
  const [settings, setSettings] = useState(null);
  const [snippets, setSnippets] = useState([]);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const sessionsRef = useRef({});

  useEffect(() => {
    fetch('/api/settings', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        setSettings(s);
        if (!s?.terminalTheme) {
          // Save default theme
          fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify({ ...s, terminalTheme: 'default' }),
          }).catch(() => {});
        }
      })
      .catch(() => {});
    apiJson('/api/snippets').then((d) => setSnippets(d.items)).catch(() => {});
  }, []);

  const newTab = () => {
    const id = nextId;
    setNextId(id + 1);
    setTabs((t) => [...t, { id, label: `Shell ${id}` }]);
    setActive(id);
  };

  const closeTab = (id) => {
    setTabs((t) => {
      const next = t.filter((x) => x.id !== id);
      if (next.length === 0) {
        setNextId((n) => n + 1);
        return [{ id: nextId + 1, label: 'Shell' }];
      }
      if (active === id) setActive(next[next.length - 1].id);
      return next;
    });
  };

  const renameTab = (id) => {
    setRenaming(id);
  };

  const submitRename = (id, value) => {
    const label = value.trim() || `Shell ${id}`;
    setTabs((t) => t.map((tab) => tab.id === id ? { ...tab, label } : tab));
    setRenaming(null);
  };

  const changeTheme = async (themeName) => {
    setThemeOpen(false);
    const newSettings = { ...settings, terminalTheme: themeName };
    setSettings(newSettings);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ terminalTheme: themeName }),
      });
      notify?.(`Theme: ${THEME_LABELS[themeName]}`, 'success');
    } catch {}
  };

  const insertSnippet = (s) => {
    const sess = sessionsRef.current[active];
    if (sess?.send) {
      sess.send(`${s.value}\r`);
      sess.focus?.();
      notify?.(`Sent: ${s.name}`, 'info');
    }
  };

  const currentTheme = settings?.terminalTheme || 'default';

  return (
    <div class="term-shell">
      <div class="term-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            class={`term-tab ${active === t.id ? 'active' : ''}`}
            onClick={() => setActive(t.id)}
            onDblClick={() => renameTab(t.id)}
            title="Double-click to rename"
          >
            <span class="material-symbols-outlined" style={{ fontSize: 14 }}>terminal</span>
            {renaming === t.id ? (
              <input
                class="term-rename-input"
                value={t.label}
                autoFocus
                style={{
                  fontFamily: 'inherit',
                  fontSize: 12,
                  background: 'transparent',
                  border: '1px solid var(--brand-500)',
                  borderRadius: 4,
                  color: 'var(--text-main)',
                  padding: '1px 6px',
                  width: 100,
                  outline: 'none',
                }}
                onBlur={(e) => submitRename(t.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename(t.id, e.target.value);
                  if (e.key === 'Escape') setRenaming(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span>{t.label}</span>
            )}
            {tabs.length > 1 && (
              <span
                class="term-tab-close"
                onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}
                title="Close tab"
              >&times;</span>
            )}
          </button>
        ))}
        <button class="term-new" onClick={newTab} title="New terminal tab">
          <span class="material-symbols-outlined">add</span>
        </button>
        <span style={{ flex: 1 }} />

        {/* Theme selector */}
        <div style={{ position: 'relative' }}>
          <button
            class="term-new"
            title="Change theme"
            onClick={() => setThemeOpen((o) => !o)}
            style={{ color: themeOpen ? 'var(--brand-400)' : undefined }}
          >
            <span class="material-symbols-outlined">palette</span>
          </button>
          {themeOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 4,
              zIndex: 100,
              minWidth: 180,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}>
              {Object.entries(THEME_LABELS).map(([key, label]) => (
                <div
                  key={key}
                  onClick={() => changeTheme(key)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: currentTheme === key ? 'var(--brand-400)' : 'var(--text-secondary)',
                    background: currentTheme === key ? 'var(--bg-hover)' : 'transparent',
                    fontWeight: currentTheme === key ? 600 : 400,
                  }}
                >
                  <span style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background: TERMINAL_THEMES[key]?.background || '#000',
                    border: '1px solid var(--border)',
                    flexShrink: 0,
                  }} />
                  {label}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Snippets toggle */}
        <button
          class="term-new"
          title="Snippets library"
          onClick={() => setSnippetsOpen((o) => !o)}
          style={{ color: snippetsOpen ? 'var(--brand-400)' : undefined }}
        >
          <span class="material-symbols-outlined">bolt</span>
        </button>
      </div>
      <div class="term-stage">
        {snippetsOpen && (
          <div class="term-snippets">
            <div style={{
              padding: '10px 12px',
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              fontWeight: 600,
            }}>
              Snippets
            </div>
            {snippets.length === 0 && (
              <div style={{ padding: 20, fontSize: 12, textAlign: 'center', color: 'var(--text-muted)' }}>
                No snippets saved yet
              </div>
            )}
            {snippets.map((s) => (
              <div key={s.id} class="term-snippet" onClick={() => insertSnippet(s)} title={s.value}>
                <div style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-secondary)' }}>{s.name}</div>
                <div class="cell-ellipsis" style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
                }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
          {tabs.map((t) => (
            <div
              key={`sess-${t.id}`}
              style={{
                display: t.id === active ? 'flex' : 'none',
                flex: 1, minHeight: 0,
                position: 'absolute', inset: 0,
              }}
            >
              <TerminalSession
                sessionId={t.label}
                settings={settings}
                onReady={(api) => { sessionsRef.current[t.id] = api; }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
