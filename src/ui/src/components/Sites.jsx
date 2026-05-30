import { useEffect, useState } from 'preact/hooks';
import { apiJson } from '../api.js';

export function Sites({ notify }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const d = await apiJson('/api/sites');
      setSites(d.sites);
    } catch (e) {
      notify(`Load failed: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div class="sites-shell">
      <div class="proc-toolbar">
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          Detected local servers — open via secure proxy
        </span>
        <span style={{ flex: 1 }} />
        <button class="btn" onClick={load}>
          <span class="material-symbols-outlined">refresh</span> Scan
        </button>
      </div>
      <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {loading ? (
          <div class="empty"><span class="material-symbols-outlined">hourglass_empty</span></div>
        ) : sites.length === 0 ? (
          <div class="empty">
            <span class="material-symbols-outlined">cloud_off</span>
            <span>No local dev servers detected</span>
            <span style={{ fontSize: 11 }}>Scans common ports (3000, 5173, 8080, 9000…)</span>
          </div>
        ) : (
          sites.map((s) => (
            <a
              key={s.port}
              href={`/proxy/${s.port}/`}
              target="_blank"
              rel="noreferrer"
              class="site-card"
            >
              <span class="material-symbols-outlined" style={{ fontSize: 28, color: 'var(--brand-400)' }}>language</span>
              <div>
                <div style={{ fontWeight: 600 }}>localhost:{s.port}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>open via /proxy/{s.port}/</div>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
