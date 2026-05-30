import { useEffect, useState } from 'preact/hooks';
import { apiJson } from '../api.js';

function fmtTime(t) {
  if (!t) return '—';
  const ago = Date.now() - t;
  const s = Math.floor(ago / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(t).toLocaleString();
}

export function Devices({ notify }) {
  const [devices, setDevices] = useState([]);
  const [pairing, setPairing] = useState(null);

  const load = async () => {
    try {
      const d = await apiJson('/api/auth/devices');
      setDevices(d.devices);
    } catch (e) {
      notify(`Load failed: ${e.message}`, 'error');
    }
  };

  const loadPairing = async () => {
    try {
      const p = await apiJson('/api/auth/pairing');
      setPairing(p);
    } catch {}
  };

  useEffect(() => {
    load();
    loadPairing();
    const id = setInterval(() => { load(); loadPairing(); }, 8000);
    return () => clearInterval(id);
  }, []);

  const revoke = async (id) => {
    if (!confirm('Revoke this device? It will be signed out.')) return;
    try {
      await apiJson(`/api/auth/devices/${id}`, { method: 'DELETE' });
      notify('Device revoked', 'success');
      load();
    } catch (e) {
      notify(`Revoke failed: ${e.message}`, 'error');
    }
  };

  return (
    <div class="devices-shell">
      {pairing && (
        <div class="system-card" style={{ margin: 16 }}>
          <div class="label">Active pair code</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 600, color: 'var(--brand-400)', letterSpacing: 4 }}>
            {pairing.code}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            Expires {new Date(pairing.expiresAt).toLocaleTimeString()}
          </div>
        </div>
      )}

      <div style={{ padding: '0 16px 16px' }}>
        <h3 style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', margin: '8px 0 12px' }}>
          Paired devices ({devices.length})
        </h3>
        {devices.length === 0 ? (
          <div class="empty"><span class="material-symbols-outlined">devices_off</span><span>No paired devices</span></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {devices.map((d) => (
              <div key={d.id} class="device-row">
                <span class="material-symbols-outlined" style={{ color: 'var(--brand-400)' }}>computer</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{d.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {d.id} · paired {fmtTime(d.pairedAt)} · seen {fmtTime(d.lastSeen)}
                  </div>
                </div>
                <button class="btn-icon danger" onClick={() => revoke(d.id)} title="Revoke">
                  <span class="material-symbols-outlined">link_off</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
