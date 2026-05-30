import { useState } from 'preact/hooks';
import { apiJson } from '../api.js';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];

export function Http({ notify }) {
  const [method, setMethod] = useState('GET');
  const [url, setUrl] = useState('https://httpbin.org/get');
  const [headers, setHeaders] = useState('Content-Type: application/json');
  const [body, setBody] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!url) return;
    const hdr = {};
    headers.split('\n').forEach((line) => {
      const i = line.indexOf(':');
      if (i > 0) hdr[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    });
    setBusy(true);
    try {
      const r = await apiJson('/api/http', {
        method: 'POST',
        body: { method, url, headers: hdr, body: body || null },
      });
      setRes(r);
    } catch (e) {
      setRes({ error: e.message });
      notify(`HTTP: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="http-shell">
      <div class="http-bar">
        <select class="input" value={method} onChange={(e) => setMethod(e.target.value)} style={{ width: 100 }}>
          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          class="input"
          value={url}
          onInput={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          style={{ flex: 1 }}
          placeholder="https://api.example.com/v1/users"
        />
        <button class="btn" onClick={send} disabled={busy} style={{ background: 'var(--brand-500)', color: '#fff', borderColor: 'var(--brand-500)' }}>
          {busy ? '…' : 'Send'}
        </button>
      </div>
      <div class="http-body">
        <div class="http-pane">
          <div class="git-pane-head">Headers</div>
          <textarea
            class="editor-textarea"
            spellcheck={false}
            value={headers}
            onInput={(e) => setHeaders(e.target.value)}
            placeholder="Authorization: Bearer …"
            style={{ minHeight: 100 }}
          />
          <div class="git-pane-head">Body</div>
          <textarea
            class="editor-textarea"
            spellcheck={false}
            value={body}
            onInput={(e) => setBody(e.target.value)}
            placeholder='{"hello": "world"}'
          />
        </div>
        <div class="http-pane">
          <div class="git-pane-head">
            {res ? (
              res.error ? <span style={{ color: 'var(--danger)' }}>error</span> : (
                <>
                  <span style={{ color: res.status >= 400 ? 'var(--danger)' : res.status >= 300 ? 'var(--warn)' : 'var(--success)' }}>
                    {res.status} {res.statusText}
                  </span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 12, fontSize: 12 }}>
                    {res.ms} ms · {res.size} bytes
                  </span>
                </>
              )
            ) : <span style={{ color: 'var(--text-muted)' }}>Response</span>}
          </div>
          <pre class="git-diff" style={{ flex: 1 }}>
            {res
              ? res.error
                ? res.error
                : (res.binary ? '[binary response, ' + res.size + ' bytes]' : (res.body || '(empty)'))
              : 'Send a request to see the response.'}
          </pre>
        </div>
      </div>
    </div>
  );
}
