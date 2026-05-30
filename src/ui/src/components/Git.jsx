import { useEffect, useState, useCallback } from 'preact/hooks';
import { apiJson } from '../api.js';

function fmtTime(ms) {
  const d = new Date(ms);
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days === 0) return d.toLocaleTimeString();
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function statusLabel(f) {
  if (f.untracked) return { label: 'New', color: '#3fb950' };
  if (f.x === 'D' || f.y === 'D') return { label: 'Deleted', color: '#f85149' };
  if (f.x === 'R' || f.y === 'R') return { label: 'Renamed', color: '#79c0ff' };
  if (f.staged && f.unstaged) return { label: 'Mixed', color: '#d29922' };
  if (f.staged) return { label: 'Staged', color: '#3fb950' };
  return { label: 'Modified', color: '#d29922' };
}

export function Git({ notify }) {
  const [cwdInput, setCwdInput] = useState('');
  const [status, setStatus] = useState(null);
  const [log, setLog] = useState([]);
  const [diff, setDiff] = useState('');
  const [diffPath, setDiffPath] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async (target) => {
    try {
      const s = await apiJson(`/api/git/status?cwd=${encodeURIComponent(target || '')}`);
      setStatus(s);
      if (s.repo) {
        const l = await apiJson(`/api/git/log?cwd=${encodeURIComponent(s.cwd)}&limit=30`);
        setLog(l.commits);
      } else {
        setLog([]);
      }
    } catch (e) {
      notify(`Git: ${e.message}`, 'error');
    }
  }, [notify]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const refresh = () => loadAll(status?.cwd || cwdInput);

  const showDiff = async (file, staged) => {
    if (!status?.repo) return;
    setDiffPath(file);
    try {
      const d = await apiJson(`/api/git/diff?cwd=${encodeURIComponent(status.cwd)}&path=${encodeURIComponent(file)}&staged=${staged ? 1 : 0}`);
      setDiff(d.diff || '(no diff)');
    } catch (e) {
      setDiff(`error: ${e.message}`);
    }
  };

  const callOp = async (op, body = {}) => {
    if (!status?.repo) return;
    setBusy(true);
    try {
      await apiJson(`/api/git/${op}`, { method: 'POST', body: { cwd: status.cwd, ...body } });
      refresh();
    } catch (e) {
      notify(`Git ${op}: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const stage = (path) => callOp('stage', { paths: [path] });
  const unstage = (path) => callOp('unstage', { paths: [path] });
  const discard = (path) => {
    if (!confirm(`Discard changes to ${path}?`)) return;
    callOp('discard', { paths: [path] });
  };
  const stageAll = () => {
    const paths = status.files.filter((f) => f.unstaged || f.untracked).map((f) => f.path);
    if (paths.length) callOp('stage', { paths });
  };
  const commit = async () => {
    if (!message.trim()) { notify('Enter a commit message', 'error'); return; }
    await callOp('commit', { message: message.trim() });
    setMessage('');
    notify('Committed', 'success');
  };
  const pull = async () => {
    setBusy(true);
    try {
      const r = await apiJson('/api/git/pull', { method: 'POST', body: { cwd: status.cwd } });
      notify(`Pulled: ${r.output.split('\n')[0]}`, 'success');
      refresh();
    } catch (e) {
      notify(`Pull: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };
  const push = async () => {
    setBusy(true);
    try {
      await apiJson('/api/git/push', { method: 'POST', body: { cwd: status.cwd } });
      notify('Pushed', 'success');
      refresh();
    } catch (e) {
      notify(`Push: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="git-shell">
      <div class="git-toolbar">
        <input
          class="input"
          style={{ flex: 1, maxWidth: 480, fontFamily: 'JetBrains Mono, monospace' }}
          value={status?.cwd || cwdInput}
          onInput={(e) => setCwdInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadAll(cwdInput)}
          placeholder="Path to a git repo"
        />
        <button class="btn" onClick={refresh}>
          <span class="material-symbols-outlined">refresh</span>
        </button>
        {status?.repo && (
          <>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              <span class="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: '-2px' }}>fork_right</span>
              {' '}{status.branch}
              {(status.ahead || status.behind) && (
                <span style={{ marginLeft: 8 }}>
                  {status.ahead ? `↑${status.ahead}` : ''}{status.behind ? ` ↓${status.behind}` : ''}
                </span>
              )}
            </span>
            <div style={{ flex: 1 }} />
            <button class="btn" onClick={pull} disabled={busy}>
              <span class="material-symbols-outlined">download</span> Pull
            </button>
            <button class="btn" onClick={push} disabled={busy}>
              <span class="material-symbols-outlined">upload</span> Push
            </button>
          </>
        )}
      </div>

      {!status?.repo ? (
        <div class="empty">
          <span class="material-symbols-outlined">folder_off</span>
          <span>{status ? `Not a git repo: ${status.cwd}` : 'Loading…'}</span>
        </div>
      ) : (
        <div class="git-body">
          <div class="git-files">
            <div class="git-section-head">
              <span>Changes ({status.files.length})</span>
              <button class="btn" onClick={stageAll}>Stage all</button>
            </div>
            {status.files.length === 0 ? (
              <div class="empty" style={{ padding: 24 }}>
                <span class="material-symbols-outlined">check_circle</span>
                <span>Working tree clean</span>
              </div>
            ) : (
              status.files.map((f) => {
                const s = statusLabel(f);
                return (
                  <div
                    key={f.path}
                    class={`git-file ${diffPath === f.path ? 'selected' : ''}`}
                    onClick={() => showDiff(f.path, f.staged)}
                  >
                    <span style={{ color: s.color, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', width: 70 }}>{s.label}</span>
                    <span class="cell-ellipsis" style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} title={f.path}>{f.path}</span>
                    <span class="git-actions">
                      {!f.staged && (
                        <button class="btn-icon" onClick={(e) => { e.stopPropagation(); stage(f.path); }} title="Stage">
                          <span class="material-symbols-outlined">add</span>
                        </button>
                      )}
                      {f.staged && (
                        <button class="btn-icon" onClick={(e) => { e.stopPropagation(); unstage(f.path); }} title="Unstage">
                          <span class="material-symbols-outlined">remove</span>
                        </button>
                      )}
                      {!f.untracked && (
                        <button class="btn-icon danger" onClick={(e) => { e.stopPropagation(); discard(f.path); }} title="Discard">
                          <span class="material-symbols-outlined">undo</span>
                        </button>
                      )}
                    </span>
                  </div>
                );
              })
            )}

            <div class="git-commit">
              <textarea
                class="git-msg"
                placeholder="Commit message…"
                rows={3}
                value={message}
                onInput={(e) => setMessage(e.target.value)}
              />
              <button class="btn" style={{ background: 'var(--brand-500)', color: '#fff', borderColor: 'var(--brand-500)' }} onClick={commit} disabled={busy || !message.trim()}>
                <span class="material-symbols-outlined">check</span> Commit
              </button>
            </div>
          </div>

          <div class="git-pane">
            {diffPath ? (
              <>
                <div class="git-pane-head">{diffPath}</div>
                <pre class="git-diff">{diff}</pre>
              </>
            ) : (
              <>
                <div class="git-pane-head">Recent commits</div>
                <div class="git-log">
                  {log.map((c) => (
                    <div key={c.hash} class="git-commit-row">
                      <span class="git-commit-hash">{c.short}</span>
                      <span class="git-commit-subj cell-ellipsis" title={c.subject}>{c.subject}</span>
                      <span class="git-commit-meta">{c.author} · {fmtTime(c.time)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
