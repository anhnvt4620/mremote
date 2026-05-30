import { useEffect, useState, useRef } from 'preact/hooks';

const STATUS_LABELS = { connected: 'Online', offline: 'Offline', connecting: 'Connecting…' };
const STATUS_DOT = { connected: 'connected', offline: 'offline', connecting: 'connecting' };

export function Topbar({ title, onLogout }) {
  const [healthy, setHealthy] = useState('connecting');
  const timerRef = useRef(null);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('/api/health');
        setHealthy(r.ok ? 'connected' : 'offline');
      } catch {
        setHealthy('offline');
      }
    };
    check();
    timerRef.current = setInterval(check, 8000);
    return () => clearInterval(timerRef.current);
  }, []);

  return (
    <header class="topbar">
      <div class="title">{title}</div>
      <div style={{ flex: 1 }} />
      <span class="status-pill">
        <span class={`dot ${STATUS_DOT[healthy] || 'offline'}`} />
        {STATUS_LABELS[healthy] || 'Unknown'}
      </span>
      {onLogout && (
        <button
          onClick={onLogout}
          title="Sign out"
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            color: 'var(--text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            marginLeft: 4,
          }}
        >
          <span class="material-symbols-outlined">logout</span>
        </button>
      )}
    </header>
  );
}
