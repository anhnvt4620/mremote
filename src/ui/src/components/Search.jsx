import { useEffect, useState } from 'preact/hooks';
import { apiJson } from '../api.js';

export function Search({ notify, onOpen }) {
  const [query, setQuery] = useState('');
  const [glob, setGlob] = useState('');
  const [cwd, setCwd] = useState('');
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [kind, setKind] = useState('content');
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState(null);

  const run = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const d = await apiJson('/api/search', {
        method: 'POST',
        body: { query, glob, cwd, regex, caseSensitive, kind },
      });
      setData(d);
    } catch (e) {
      notify(`Search: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="search-shell">
      <div class="search-toolbar">
        <input
          class="input"
          placeholder={kind === 'name' ? 'File name pattern' : 'Search text'}
          value={query}
          onInput={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          style={{ flex: 1, maxWidth: 360 }}
          autoFocus
        />
        <input
          class="input"
          placeholder="Glob filter (e.g. *.js,*.ts)"
          value={glob}
          onInput={(e) => setGlob(e.target.value)}
          style={{ width: 220 }}
        />
        <select class="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="content">Content</option>
          <option value="name">File name</option>
        </select>
        <label class="search-chk"><input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} /> Regex</label>
        <label class="search-chk"><input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} /> Aa</label>
        <button class="btn" onClick={run} disabled={busy}>
          <span class="material-symbols-outlined">search</span> {busy ? 'Searching…' : 'Search'}
        </button>
      </div>
      <div class="search-toolbar" style={{ borderTop: 'none' }}>
        <input
          class="input"
          placeholder="Search in (leave empty for $HOME)"
          value={cwd}
          onInput={(e) => setCwd(e.target.value)}
          style={{ flex: 1, maxWidth: 600, fontFamily: 'JetBrains Mono, monospace' }}
        />
      </div>
      <div class="search-results">
        {!data ? (
          <div class="empty"><span class="material-symbols-outlined">manage_search</span><span>Enter a query to search</span></div>
        ) : data.results.length === 0 ? (
          <div class="empty"><span class="material-symbols-outlined">inbox</span><span>No matches in {data.scanned} files</span></div>
        ) : (
          <>
            <div class="search-summary">
              {data.results.length} files matched · scanned {data.scanned} files
              {data.truncated && <span style={{ color: 'var(--warn)', marginLeft: 8 }}>(results truncated)</span>}
            </div>
            {data.results.map((r) => (
              <div key={r.file} class="search-file">
                <div class="search-file-head" onClick={() => onOpen?.(r.file)}>
                  <span class="material-symbols-outlined" style={{ color: 'var(--brand-400)', fontSize: 16 }}>description</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{r.file}</span>
                </div>
                {r.hits.map((h, i) => (
                  <div key={i} class="search-hit">
                    {h.line > 0 && <span class="search-line">{h.line}:{h.col}</span>}
                    <span class="search-text">{h.text}</span>
                  </div>
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
