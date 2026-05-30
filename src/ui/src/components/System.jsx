import { useEffect, useState } from 'preact/hooks';
import { apiJson } from '../api.js';

function fmtBytes(n) {
  if (!n) return '0 B';
  const k = 1024;
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(2)} ${u[i]}`;
}

function fmtUptime(s) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d) parts.push(d + 'd');
  if (h) parts.push(h + 'h');
  parts.push(m + 'm');
  return parts.join(' ');
}

export function System() {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setInfo(await apiJson('/api/system/info'));
      } catch (e) {
        setErr(e.message);
      }
    };
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  if (err) return <div class="empty">Error: {err}</div>;
  if (!info) return <div class="empty"><span class="material-symbols-outlined">hourglass_empty</span><span>Loading…</span></div>;

  const memUsed = info.totalMem - info.freeMem;
  const memPct = ((memUsed / info.totalMem) * 100).toFixed(1);

  return (
    <div class="system-grid">
      <div class="system-card">
        <div class="label">Host</div>
        <div class="value">{info.hostname}</div>
        <div style={{ marginTop: 8 }}>
          <div class="row"><span class="k">User</span><span class="v">{info.user}</span></div>
          <div class="row"><span class="k">Platform</span><span class="v">{info.platform} {info.arch}</span></div>
          <div class="row"><span class="k">Release</span><span class="v">{info.release}</span></div>
        </div>
      </div>
      <div class="system-card">
        <div class="label">CPU</div>
        <div class="value" style={{ fontSize: 12 }}>{info.cpuModel}</div>
        <div style={{ marginTop: 8 }}>
          <div class="row"><span class="k">Cores</span><span class="v">{info.cpus}</span></div>
        </div>
      </div>
      <div class="system-card">
        <div class="label">Memory</div>
        <div class="value">{fmtBytes(memUsed)} / {fmtBytes(info.totalMem)}</div>
        <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
          <div style={{
            width: `${memPct}%`,
            height: '100%',
            background: memPct > 85 ? 'var(--danger)' : memPct > 65 ? 'var(--warn)' : 'var(--brand-500)',
            transition: 'width 0.4s',
          }} />
        </div>
        <div class="row" style={{ marginTop: 8 }}><span class="k">Free</span><span class="v">{fmtBytes(info.freeMem)}</span></div>
      </div>
      <div class="system-card">
        <div class="label">Uptime</div>
        <div class="value">{fmtUptime(info.uptime)}</div>
      </div>
      <div class="system-card">
        <div class="label">Runtime</div>
        <div class="row"><span class="k">Node</span><span class="v">{info.nodeVersion}</span></div>
        <div class="row"><span class="k">Home</span><span class="v">{info.home}</span></div>
        <div class="row"><span class="k">Root</span><span class="v">{info.rootDir}</span></div>
      </div>
      <div class="system-card">
        <div class="label">Identity</div>
        <div class="value" style={{ fontSize: 11 }}>{info.machineId}</div>
      </div>
    </div>
  );
}
