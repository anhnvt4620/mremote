import { useEffect, useState } from 'preact/hooks';
import { apiJson } from '../api.js';

const FIELDS = [
  { key: 'defaultShell', label: 'Default shell', placeholder: 'e.g. powershell.exe, /bin/zsh', kind: 'text' },
  { key: 'defaultCwd', label: 'Default working directory', placeholder: 'leave blank to use $HOME', kind: 'text' },
  { key: 'fontFamily', label: 'Terminal font family', placeholder: 'JetBrains Mono', kind: 'text' },
  { key: 'fontSize', label: 'Terminal font size', kind: 'number' },
  { key: 'cursorStyle', label: 'Cursor style', kind: 'select', options: ['bar', 'block', 'underline'] },
  { key: 'cursorBlink', label: 'Blink cursor', kind: 'bool' },
];

export function Settings({ notify }) {
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setCfg(await apiJson('/api/settings'));
    } catch (e) {
      notify(`Load failed: ${e.message}`, 'error');
    }
  };

  useEffect(() => { load(); }, []);

  const update = async (next) => {
    setBusy(true);
    try {
      const saved = await apiJson('/api/settings', { method: 'POST', body: next });
      setCfg(saved);
    } catch (e) {
      notify(`Save failed: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!confirm('Reset all settings to defaults?')) return;
    try {
      const saved = await apiJson('/api/settings/reset', { method: 'POST' });
      setCfg(saved);
      notify('Settings reset', 'success');
    } catch (e) {
      notify(`Reset failed: ${e.message}`, 'error');
    }
  };

  if (!cfg) return <div class="empty"><span class="material-symbols-outlined">hourglass_empty</span></div>;

  return (
    <div class="settings-shell">
      <h3>Terminal & host preferences</h3>
      <p class="muted">Stored in <code>~/.m-termius/config.json</code>. Re-open a terminal tab for shell changes to take effect.</p>

      {FIELDS.map((f) => (
        <div key={f.key} class="settings-row">
          <label>{f.label}</label>
          {f.kind === 'text' && (
            <input
              class="input"
              value={cfg[f.key] || ''}
              placeholder={f.placeholder}
              disabled={busy}
              onChange={(e) => update({ [f.key]: e.target.value })}
            />
          )}
          {f.kind === 'number' && (
            <input
              class="input"
              type="number"
              value={cfg[f.key]}
              disabled={busy}
              onChange={(e) => update({ [f.key]: Number(e.target.value) || 13 })}
            />
          )}
          {f.kind === 'bool' && (
            <input
              type="checkbox"
              checked={!!cfg[f.key]}
              disabled={busy}
              onChange={(e) => update({ [f.key]: e.target.checked })}
            />
          )}
          {f.kind === 'select' && (
            <select
              class="input"
              value={cfg[f.key]}
              disabled={busy}
              onChange={(e) => update({ [f.key]: e.target.value })}
            >
              {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        <button class="btn danger" onClick={reset}>Reset to defaults</button>
      </div>
    </div>
  );
}
