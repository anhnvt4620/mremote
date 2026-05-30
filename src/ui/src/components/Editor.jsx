import { useEffect, useState } from 'preact/hooks';
import { CodeMirror } from './CodeMirror.jsx';
import { api, apiJson } from '../api.js';

export function Editor({ filePath, setFilePath, notify }) {
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [lang, setLang] = useState('plaintext');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!filePath) {
      setContent(''); setOriginal(''); setLang('plaintext');
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const d = await apiJson(`/api/fs/read?path=${encodeURIComponent(filePath)}`);
        if (cancelled) return;
        if (d.binary) {
          notify('Binary file — open externally', 'error');
          setContent('[binary]');
          setOriginal('[binary]');
        } else {
          setContent(d.content || '');
          setOriginal(d.content || '');
        }
        try {
          const lr = await apiJson(`/api/editor/lang?path=${encodeURIComponent(filePath)}`);
          setLang(lr.language);
        } catch {}
      } catch (e) {
        notify(`Open failed: ${e.message}`, 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filePath, notify]);

  const save = async () => {
    if (!filePath) return;
    setSaving(true);
    try {
      await apiJson('/api/fs/write', { method: 'POST', body: { path: filePath, content } });
      setOriginal(content);
      notify('Saved', 'success');
    } catch (e) {
      notify(`Save failed: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!filePath) {
    return (
      <div class="empty">
        <span class="material-symbols-outlined">edit_document</span>
        <span>Open a file from the Files tab to edit</span>
      </div>
    );
  }

  const dirty = content !== original;

  return (
    <div class="editor-host">
      <div class="editor-toolbar">
        <span class="material-symbols-outlined" style={{ color: 'var(--brand-400)' }}>description</span>
        <span class="filename">{filePath}{dirty ? ' •' : ''}</span>
        <span class="lang-tag">{lang}</span>
        <div style={{ flex: 1 }} />
        <button
          onClick={save}
          disabled={!dirty || saving}
          style={{
            padding: '5px 14px',
            borderRadius: 6,
            background: dirty ? 'var(--brand-500)' : 'var(--bg-elevated)',
            color: dirty ? '#fff' : 'var(--text-muted)',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {saving ? 'Saving…' : 'Save (Ctrl+S)'}
        </button>
        <button
          onClick={() => setFilePath(null)}
          style={{ padding: '5px 10px', borderRadius: 6, color: 'var(--text-muted)' }}
          title="Close"
        >
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {loading ? (
          <div class="empty"><span class="material-symbols-outlined">hourglass_empty</span><span>Loading…</span></div>
        ) : (
          <CodeMirror value={content} onChange={setContent} language={lang} onSave={save} />
        )}
      </div>
    </div>
  );
}
