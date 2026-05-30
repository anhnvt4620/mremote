import { useEffect, useState } from 'preact/hooks';
import { apiJson } from '../api.js';
import { SshSession } from './SshSession.jsx';

const EMPTY_FORM = {
  id: '', label: '', host: '', port: 22, user: '', auth: 'password', password: '', privateKeyPath: '', passphrase: '',
};

export function Ssh({ notify }) {
  const [hosts, setHosts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [active, setActive] = useState(null);

  const load = async () => {
    try { setHosts((await apiJson('/api/ssh/hosts')).hosts); } catch (e) { notify(`Load: ${e.message}`, 'error'); }
  };

  useEffect(() => { load(); }, []);

  const startEdit = (host) => {
    setEditing(host?.id || 'new');
    setForm(host ? { ...EMPTY_FORM, ...host } : { ...EMPTY_FORM });
  };

  const cancel = () => { setEditing(null); setForm(EMPTY_FORM); };

  const saveHost = async () => {
    try {
      await apiJson('/api/ssh/hosts', { method: 'POST', body: form });
      notify('Saved', 'success');
      setEditing(null);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      notify(`Save: ${e.message}`, 'error');
    }
  };

  const removeHost = async (id) => {
    if (!confirm('Delete this host?')) return;
    try {
      await apiJson(`/api/ssh/hosts/${id}`, { method: 'DELETE' });
      load();
    } catch (e) { notify(`Delete: ${e.message}`, 'error'); }
  };

  const test = async (id) => {
    try {
      await apiJson(`/api/ssh/test/${id}`, { method: 'POST' });
      notify('Connection OK', 'success');
    } catch (e) {
      notify(`Test failed: ${e.message}`, 'error');
    }
  };

  if (active) {
    return (
      <div class="ssh-shell">
        <div class="proc-toolbar">
          <button class="btn" onClick={() => setActive(null)}>
            <span class="material-symbols-outlined">arrow_back</span> Back to hosts
          </button>
          <span style={{ color: 'var(--text-muted)', marginLeft: 12 }}>{active.user}@{active.host}:{active.port}</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <SshSession host={active} onStatusChange={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div class="ssh-shell">
      <div class="proc-toolbar">
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Saved SSH hosts</span>
        <span style={{ flex: 1 }} />
        <button class="btn" onClick={() => startEdit(null)}>
          <span class="material-symbols-outlined">add</span> New host
        </button>
      </div>

      {editing && (
        <div class="ssh-form">
          <h4>{editing === 'new' ? 'Add SSH host' : 'Edit host'}</h4>
          <div class="ssh-grid">
            <Field label="Label" value={form.label} on={(v) => setForm({ ...form, label: v })} placeholder="my-server" />
            <Field label="Host" value={form.host} on={(v) => setForm({ ...form, host: v })} placeholder="example.com or 10.0.0.5" />
            <Field label="Port" type="number" value={form.port} on={(v) => setForm({ ...form, port: Number(v) || 22 })} />
            <Field label="Username" value={form.user} on={(v) => setForm({ ...form, user: v })} placeholder="root" />
            <div class="ssh-field">
              <label>Auth method</label>
              <select class="input" value={form.auth} onChange={(e) => setForm({ ...form, auth: e.target.value })}>
                <option value="password">Password</option>
                <option value="key">Private key</option>
              </select>
            </div>
            {form.auth === 'password' ? (
              <Field label="Password" type="password" value={form.password} on={(v) => setForm({ ...form, password: v })} />
            ) : (
              <>
                <Field label="Private key path" value={form.privateKeyPath} on={(v) => setForm({ ...form, privateKeyPath: v })} placeholder="~/.ssh/id_ed25519" />
                <Field label="Passphrase (optional)" type="password" value={form.passphrase} on={(v) => setForm({ ...form, passphrase: v })} />
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button class="btn" style={{ background: 'var(--brand-500)', color: '#fff', borderColor: 'var(--brand-500)' }} onClick={saveHost}>Save</button>
            <button class="btn" onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {hosts.length === 0 ? (
          <div class="empty"><span class="material-symbols-outlined">cloud</span><span>No SSH hosts yet</span></div>
        ) : hosts.map((h) => (
          <div key={h.id} class="device-row">
            <span class="material-symbols-outlined" style={{ color: 'var(--brand-400)' }}>dns</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{h.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                {h.user}@{h.host}:{h.port} · {h.auth}
              </div>
            </div>
            <button class="btn" onClick={() => setActive(h)}><span class="material-symbols-outlined">play_arrow</span> Connect</button>
            <button class="btn" onClick={() => test(h.id)} title="Test connection">
              <span class="material-symbols-outlined">network_check</span>
            </button>
            <button class="btn" onClick={() => startEdit(h)}>
              <span class="material-symbols-outlined">edit</span>
            </button>
            <button class="btn-icon danger" onClick={() => removeHost(h.id)}>
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, on, type = 'text', placeholder }) {
  return (
    <div class="ssh-field">
      <label>{label}</label>
      <input class="input" type={type} value={value || ''} placeholder={placeholder || ''} onInput={(e) => on(e.target.value)} />
    </div>
  );
}
