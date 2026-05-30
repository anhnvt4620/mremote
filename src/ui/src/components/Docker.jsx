import { useEffect, useState } from 'preact/hooks';
import { apiJson } from '../api.js';

function tone(state) {
  switch ((state || '').toLowerCase()) {
    case 'running': return '#3fb950';
    case 'paused': return '#d29922';
    case 'exited': case 'dead': return '#f85149';
    default: return '#7d8590';
  }
}

export function Docker({ notify }) {
  const [available, setAvailable] = useState(null);
  const [containers, setContainers] = useState([]);
  const [images, setImages] = useState([]);
  const [tab, setTab] = useState('containers');
  const [logs, setLogs] = useState({ id: null, text: '' });

  const load = async () => {
    try {
      const s = await apiJson('/api/docker/status');
      setAvailable(s.available);
      if (!s.available) return;
      const [c, i] = await Promise.all([
        apiJson('/api/docker/containers').catch(() => ({ items: [] })),
        apiJson('/api/docker/images').catch(() => ({ items: [] })),
      ]);
      setContainers(c.items);
      setImages(i.items);
    } catch (e) {
      notify(`Docker: ${e.message}`, 'error');
    }
  };

  useEffect(() => { load(); const id = setInterval(load, 6000); return () => clearInterval(id); }, []);

  const op = async (action, id) => {
    try {
      await apiJson(`/api/docker/${action}/${id}`, { method: action === 'rm' ? 'DELETE' : 'POST' });
      notify(`${action} ${id.slice(0, 12)}`, 'success');
      load();
    } catch (e) {
      notify(`${action} failed: ${e.message}`, 'error');
    }
  };

  const showLogs = async (id) => {
    setLogs({ id, text: 'loading…' });
    try {
      const d = await apiJson(`/api/docker/logs/${id}?tail=300`);
      setLogs({ id, text: d.logs || '(no output)' });
    } catch (e) {
      setLogs({ id, text: `error: ${e.message}` });
    }
  };

  if (available === null) {
    return <div class="empty"><span class="material-symbols-outlined">hourglass_empty</span></div>;
  }
  if (!available) {
    return (
      <div class="empty">
        <span class="material-symbols-outlined">cloud_off</span>
        <span>Docker CLI not detected</span>
        <span style={{ fontSize: 11 }}>Install Docker Desktop or the docker engine and refresh</span>
        <button class="btn" onClick={load} style={{ marginTop: 12 }}>
          <span class="material-symbols-outlined">refresh</span> Retry
        </button>
      </div>
    );
  }

  return (
    <div class="docker-shell">
      <div class="proc-toolbar">
        <button class={`btn ${tab === 'containers' ? '' : ''}`} onClick={() => setTab('containers')} style={{ background: tab === 'containers' ? 'var(--brand-tint)' : undefined, color: tab === 'containers' ? 'var(--brand-400)' : undefined }}>
          Containers ({containers.length})
        </button>
        <button class="btn" onClick={() => setTab('images')} style={{ background: tab === 'images' ? 'var(--brand-tint)' : undefined, color: tab === 'images' ? 'var(--brand-400)' : undefined }}>
          Images ({images.length})
        </button>
        <span style={{ flex: 1 }} />
        <button class="btn" onClick={load}><span class="material-symbols-outlined">refresh</span></button>
      </div>

      {tab === 'containers' ? (
        <div class="proc-table">
          <div class="proc-row proc-head">
            <div style={{ width: 90 }}>State</div>
            <div style={{ width: 200 }}>Name</div>
            <div style={{ width: 220 }}>Image</div>
            <div style={{ flex: 1 }}>Status</div>
            <div style={{ width: 220 }}>Ports</div>
            <div style={{ width: 160 }}></div>
          </div>
          {containers.length === 0 ? (
            <div class="empty"><span class="material-symbols-outlined">inbox</span><span>No containers</span></div>
          ) : containers.map((c) => (
            <div key={c.id} class="proc-row">
              <div style={{ width: 90 }}>
                <span style={{ background: tone(c.state), color: '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11 }}>{c.state}</span>
              </div>
              <div style={{ width: 200 }} class="cell-ellipsis" title={c.name}>{c.name}</div>
              <div style={{ width: 220 }} class="cell-ellipsis" title={c.image}>{c.image}</div>
              <div style={{ flex: 1, color: 'var(--text-muted)', fontSize: 12 }} class="cell-ellipsis">{c.status}</div>
              <div style={{ width: 220, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} class="cell-ellipsis">{c.ports || '—'}</div>
              <div style={{ width: 160, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <button class="btn-icon" onClick={() => showLogs(c.id)} title="Logs"><span class="material-symbols-outlined">description</span></button>
                {c.state !== 'running' ? (
                  <button class="btn-icon" onClick={() => op('start', c.id)} title="Start"><span class="material-symbols-outlined">play_arrow</span></button>
                ) : (
                  <button class="btn-icon" onClick={() => op('stop', c.id)} title="Stop"><span class="material-symbols-outlined">stop</span></button>
                )}
                <button class="btn-icon" onClick={() => op('restart', c.id)} title="Restart"><span class="material-symbols-outlined">restart_alt</span></button>
                <button class="btn-icon danger" onClick={() => op('rm', c.id)} title="Remove"><span class="material-symbols-outlined">delete</span></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div class="proc-table">
          <div class="proc-row proc-head">
            <div style={{ width: 320 }}>Repository</div>
            <div style={{ width: 160 }}>Tag</div>
            <div style={{ width: 140 }}>Size</div>
            <div style={{ flex: 1 }}>Created</div>
          </div>
          {images.map((i) => (
            <div key={i.id} class="proc-row">
              <div style={{ width: 320 }} class="cell-ellipsis" title={i.repo}>{i.repo}</div>
              <div style={{ width: 160, color: 'var(--brand-400)', fontFamily: 'JetBrains Mono, monospace' }}>{i.tag}</div>
              <div style={{ width: 140, fontFamily: 'JetBrains Mono, monospace' }}>{i.size}</div>
              <div style={{ flex: 1, color: 'var(--text-muted)', fontSize: 12 }}>{i.created}</div>
            </div>
          ))}
        </div>
      )}

      {logs.id && (
        <div class="docker-logs">
          <div class="git-pane-head">
            Logs · {logs.id.slice(0, 12)}
            <button class="btn-icon" onClick={() => setLogs({ id: null, text: '' })} style={{ float: 'right' }}>
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <pre class="git-diff">{logs.text}</pre>
        </div>
      )}
    </div>
  );
}
