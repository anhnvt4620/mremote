import { useEffect, useState, useCallback, useRef } from 'preact/hooks';
import { api, apiJson, getToken } from '../api.js';

function fmtSize(n) {
  if (!n) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

export function FileExplorer({ onOpen, notify }) {
  const [cwd, setCwd] = useState('');
  const [items, setItems] = useState([]);
  const [parent, setParent] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pathInput, setPathInput] = useState('');
  const fileInputRef = useRef(null);

  const load = useCallback(async (target) => {
    try {
      const url = target ? `/api/fs/list?path=${encodeURIComponent(target)}` : '/api/fs/list';
      const d = await apiJson(url);
      setCwd(d.cwd);
      setPathInput(d.cwd);
      setItems(d.items);
      setParent(d.parent);
      setSelected(null);
    } catch (e) {
      notify(`Load failed: ${e.message}`, 'error');
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const onItemClick = (it) => {
    if (it.isDir) load(it.path);
    else setSelected(it);
  };

  const onItemDoubleClick = (it) => {
    if (!it.isDir) onOpen(it.path);
  };

  const refresh = () => load(cwd);

  const navTo = (p) => load(p);

  const goUp = () => parent && load(parent);

  const goPath = () => pathInput && load(pathInput);

  const newFolder = async () => {
    const name = prompt('New folder name:');
    if (!name) return;
    const target = cwd.endsWith('\\') || cwd.endsWith('/') ? cwd + name : `${cwd}/${name}`;
    try {
      await apiJson('/api/fs/mkdir', { method: 'POST', body: { path: target } });
      notify('Folder created', 'success');
      refresh();
    } catch (e) {
      notify(`Mkdir failed: ${e.message}`, 'error');
    }
  };

  const newFile = async () => {
    const name = prompt('New file name:');
    if (!name) return;
    const target = cwd.endsWith('\\') || cwd.endsWith('/') ? cwd + name : `${cwd}/${name}`;
    try {
      await apiJson('/api/fs/write', { method: 'POST', body: { path: target, content: '' } });
      notify('File created', 'success');
      refresh();
      onOpen(target);
    } catch (e) {
      notify(`Create failed: ${e.message}`, 'error');
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!confirm(`Delete ${selected.name}?`)) return;
    try {
      await apiJson(`/api/fs/delete?path=${encodeURIComponent(selected.path)}`, { method: 'DELETE' });
      notify('Deleted', 'success');
      refresh();
    } catch (e) {
      notify(`Delete failed: ${e.message}`, 'error');
    }
  };

  const download = () => {
    if (!selected || selected.isDir) return;
    const t = getToken();
    const sep = '?';
    const url = `/api/fs/download?path=${encodeURIComponent(selected.path)}${t ? `&token=${encodeURIComponent(t)}` : ''}`;
    window.open(url);
  };

  const onUpload = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    try {
      const r = await api(`/api/fs/upload?dir=${encodeURIComponent(cwd)}`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error((await r.json()).error);
      notify(`Uploaded ${files.length} file(s)`, 'success');
      refresh();
    } catch (err) {
      notify(`Upload failed: ${err.message}`, 'error');
    }
    e.target.value = '';
  };

  return (
    <div class="fe-shell">
      <div class="fe-main">
        <div class="fe-pathbar">
          <button onClick={goUp} disabled={!parent} title="Up">
            <span class="material-symbols-outlined">arrow_upward</span>
          </button>
          <button onClick={refresh} title="Refresh">
            <span class="material-symbols-outlined">refresh</span>
          </button>
          <input
            class="input"
            value={pathInput}
            onInput={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goPath()}
            placeholder="Type a path and press Enter"
          />
        </div>
        <div class="fe-actions">
          <button onClick={newFolder}>
            <span class="material-symbols-outlined">create_new_folder</span>
            New folder
          </button>
          <button onClick={newFile}>
            <span class="material-symbols-outlined">note_add</span>
            New file
          </button>
          <button onClick={() => fileInputRef.current?.click()}>
            <span class="material-symbols-outlined">upload</span>
            Upload
          </button>
          <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={onUpload} />
          <button onClick={download} disabled={!selected || selected.isDir}>
            <span class="material-symbols-outlined">download</span>
            Download
          </button>
          <button class="danger" onClick={remove} disabled={!selected}>
            <span class="material-symbols-outlined">delete</span>
            Delete
          </button>
        </div>
        <div class="fe-list" style={{ flex: 1, overflowY: 'auto' }}>
          {items.length === 0 && (
            <div class="empty">
              <span class="material-symbols-outlined">folder_open</span>
              <span>Empty folder</span>
            </div>
          )}
          {items.map((it) => (
            <div
              key={it.path}
              class={`fe-row ${it.isDir ? 'dir' : ''} ${selected?.path === it.path ? 'selected' : ''}`}
              onClick={() => onItemClick(it)}
              onDblClick={() => onItemDoubleClick(it)}
            >
              <span class="icon material-symbols-outlined">
                {it.isDir ? 'folder' : 'description'}
              </span>
              <span class="name">{it.name}</span>
              <span class="meta">{!it.isDir && fmtSize(it.size)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
