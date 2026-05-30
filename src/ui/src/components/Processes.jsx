import { useEffect, useState } from 'preact/hooks';
import { apiJson } from '../api.js';

function fmtMem(b) {
  if (!b) return '—';
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
  return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export function Processes({ notify }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('mem');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const d = await apiJson(`/api/processes?sort=${sort}&limit=300`);
      setItems(d.items);
    } catch (e) {
      notify(`Load failed: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [sort]);

  const kill = async (pid) => {
    if (!confirm(`Send SIGTERM to PID ${pid}?`)) return;
    try {
      await apiJson(`/api/processes/${pid}`, { method: 'DELETE' });
      notify(`Sent kill signal to ${pid}`, 'success');
      setTimeout(load, 500);
    } catch (e) {
      notify(`Kill failed: ${e.message}`, 'error');
    }
  };

  const visible = items.filter(
    (p) =>
      !filter ||
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      String(p.pid).includes(filter) ||
      (p.cmd || '').toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div class="proc-shell">
      <div class="proc-toolbar">
        <input
          class="input"
          placeholder="Filter by name, pid, command…"
          value={filter}
          onInput={(e) => setFilter(e.target.value)}
          style={{ flex: 1, maxWidth: 360 }}
        />
        <span style={{ flex: 1 }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Sort by</span>
        <select
          class="input"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{ width: 120 }}
        >
          <option value="mem">Memory</option>
          <option value="cpu">CPU</option>
          <option value="pid">PID</option>
        </select>
        <button class="btn" onClick={load}>
          <span class="material-symbols-outlined">refresh</span>
        </button>
      </div>
      <div class="proc-table">
        <div class="proc-row proc-head">
          <div style={{ width: 80 }}>PID</div>
          <div style={{ width: 220 }}>Name</div>
          <div style={{ width: 110, textAlign: 'right' }}>Memory</div>
          <div style={{ width: 70, textAlign: 'right' }}>CPU%</div>
          <div style={{ flex: 1, minWidth: 200 }}>Command</div>
          <div style={{ width: 60 }}></div>
        </div>
        {loading ? (
          <div class="empty"><span class="material-symbols-outlined">hourglass_empty</span></div>
        ) : visible.length === 0 ? (
          <div class="empty"><span class="material-symbols-outlined">inbox</span><span>No matches</span></div>
        ) : (
          visible.map((p) => (
            <div key={p.pid} class="proc-row">
              <div style={{ width: 80, fontFamily: 'JetBrains Mono, monospace' }}>{p.pid}</div>
              <div style={{ width: 220, fontWeight: 500 }} class="cell-ellipsis" title={p.name}>{p.name}</div>
              <div style={{ width: 110, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>{fmtMem(p.mem)}</div>
              <div style={{ width: 70, textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                {p.cpu ? p.cpu.toFixed(1) : '—'}
              </div>
              <div style={{ flex: 1, minWidth: 200, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} class="cell-ellipsis" title={p.cmd}>
                {p.cmd}
              </div>
              <div style={{ width: 60, textAlign: 'right' }}>
                <button class="btn-icon danger" onClick={() => kill(p.pid)} title="Kill">
                  <span class="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
