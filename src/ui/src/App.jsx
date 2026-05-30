import { useEffect, useState, useCallback } from 'preact/hooks';
import { Sidebar } from './components/Sidebar.jsx';
import { Topbar } from './components/Topbar.jsx';
import { Terminal } from './components/Terminal.jsx';
import { FileExplorer } from './components/FileExplorer.jsx';
import { Editor } from './components/Editor.jsx';
import { Search } from './components/Search.jsx';
import { System } from './components/System.jsx';
import { Processes } from './components/Processes.jsx';
import { Devices } from './components/Devices.jsx';
import { Git } from './components/Git.jsx';
import { Sites } from './components/Sites.jsx';
import { Ssh } from './components/Ssh.jsx';
import { Docker } from './components/Docker.jsx';
import { Http } from './components/Http.jsx';
import { Logs } from './components/Logs.jsx';
import { Settings } from './components/Settings.jsx';
import { RemoteDesktop } from './components/RemoteDesktop.jsx';
import { Toast } from './components/Toast.jsx';
import { PairScreen } from './components/PairScreen.jsx';
import { setToken, apiJson } from './api.js';

const TABS = [
  { id: 'terminal', icon: 'terminal', label: 'Terminal' },
  { id: 'ssh', icon: 'dns', label: 'SSH' },
  { id: 'files', icon: 'folder', label: 'Files' },
  { id: 'editor', icon: 'edit_note', label: 'Editor' },
  { id: 'search', icon: 'search', label: 'Search' },
  { id: 'git', icon: 'fork_right', label: 'Git' },
  { id: 'docker', icon: 'deployed_code', label: 'Docker' },
  { id: 'desktop', icon: 'desktop_windows', label: 'Desktop' },
  { id: 'http', icon: 'http', label: 'HTTP' },
  { id: 'logs', icon: 'description', label: 'Logs' },
  { id: 'sites', icon: 'public', label: 'Sites' },
  { id: 'processes', icon: 'memory', label: 'Processes' },
  { id: 'system', icon: 'monitoring', label: 'System' },
  { id: 'devices', icon: 'devices', label: 'Devices' },
  { id: 'settings', icon: 'settings', label: 'Settings' },
];

export function App() {
  const [tab, setTab] = useState('terminal');
  const [editingFile, setEditingFile] = useState(null);
  const [toast, setToast] = useState(null);
  const [authState, setAuthState] = useState({ checked: false, ok: false, enabled: true });

  const checkAuth = useCallback(async () => {
    try {
      const data = await apiJson('/api/auth/status');
      setAuthState({ checked: true, ok: data.authenticated || !data.enabled, enabled: data.enabled });
    } catch {
      setAuthState({ checked: true, ok: false, enabled: true });
    }
  }, []);

  useEffect(() => {
    if (location.hash.startsWith('#/pair')) {
      setAuthState({ checked: true, ok: false, enabled: true });
      return;
    }
    checkAuth();
  }, [checkAuth]);

  const notify = useCallback((message, kind = 'info') => {
    setToast({ message, kind, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const openInEditor = (filePath) => {
    setEditingFile(filePath);
    setTab('editor');
  };

  const logout = () => {
    setToken('');
    location.hash = '#/pair';
    setAuthState({ checked: true, ok: false, enabled: true });
  };

  // Loading state
  if (!authState.checked) {
    return (
      <div class="empty">
        <div class="loading-spinner" />
        <div class="empty-title">Starting M-Termius...</div>
      </div>
    );
  }

  // Auth required
  if (!authState.ok) {
    return (
      <PairScreen
        onPaired={() => {
          location.hash = '';
          checkAuth();
        }}
      />
    );
  }

  return (
    <div class="app-shell">
      <Sidebar tabs={TABS} active={tab} onChange={setTab} />
      <div class="main-pane">
        <Topbar
          title={TABS.find((t) => t.id === tab)?.label || 'M-Termius'}
          onLogout={authState.enabled ? logout : null}
        />
        <div class="content">
          {tab === 'terminal' && <Terminal notify={notify} />}
          {tab === 'ssh' && <Ssh notify={notify} />}
          {tab === 'files' && <FileExplorer onOpen={openInEditor} notify={notify} />}
          {tab === 'editor' && <Editor filePath={editingFile} setFilePath={setEditingFile} notify={notify} />}
          {tab === 'search' && <Search notify={notify} onOpen={openInEditor} />}
          {tab === 'git' && <Git notify={notify} />}
          {tab === 'docker' && <Docker notify={notify} />}
          {tab === 'desktop' && <RemoteDesktop notify={notify} />}
          {tab === 'http' && <Http notify={notify} />}
          {tab === 'logs' && <Logs notify={notify} />}
          {tab === 'sites' && <Sites notify={notify} />}
          {tab === 'processes' && <Processes notify={notify} />}
          {tab === 'system' && <System />}
          {tab === 'devices' && <Devices notify={notify} />}
          {tab === 'settings' && <Settings notify={notify} />}
        </div>
      </div>
      {toast && <Toast {...toast} />}
    </div>
  );
}
