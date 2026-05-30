import { useEffect, useState } from 'preact/hooks';
import { setToken } from '../api.js';

export function PairScreen({ onPaired }) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const m = location.hash.match(/code=(\d{6})/);
    if (m) setCode(m[1]);
    if (!label) {
      const ua = navigator.userAgent;
      if (/iPhone|iPad/.test(ua)) setLabel('iOS device');
      else if (/Android/.test(ua)) setLabel('Android device');
      else if (/Mac/.test(ua)) setLabel('Mac browser');
      else if (/Windows/.test(ua)) setLabel('Windows browser');
      else setLabel('Browser');
    }
  }, []);

  const submit = async (e) => {
    e?.preventDefault?.();
    setErr(null);
    if (!/^\d{6}$/.test(code)) {
      setErr('Code must be 6 digits');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/auth/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, label: label || 'unnamed' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'pair failed');
      setToken(data.token);
      onPaired?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="pair-screen">
      <form class="pair-card" onSubmit={submit}>
        <div class="pair-brand">
          <div class="pair-logo">M</div>
          <h1>M-Termius</h1>
          <p class="pair-sub">Enter the 6-digit code shown in the host terminal</p>
        </div>

        <label class="pair-label">Pair code</label>
        <input
          class="pair-code"
          maxLength={6}
          inputMode="numeric"
          autoFocus
          value={code}
          onInput={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
        />

        <label class="pair-label">Device name</label>
        <input
          class="pair-input"
          value={label}
          onInput={(e) => setLabel(e.target.value)}
          placeholder="My phone"
        />

        {err && <div class="pair-err">{err}</div>}

        <button class="pair-btn" disabled={busy || code.length !== 6}>
          {busy ? 'Pairing…' : 'Pair this device'}
        </button>

        <div class="pair-hint">
          The code is shown when the host runs <code>m-termius</code>. Codes expire after 30 minutes.
        </div>
      </form>
    </div>
  );
}
