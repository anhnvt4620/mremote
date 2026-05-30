const KEY = 'm-termius-token';

export function getToken() {
  return localStorage.getItem(KEY) || '';
}

export function setToken(t) {
  if (t) localStorage.setItem(KEY, t);
  else localStorage.removeItem(KEY);
}

export async function api(path, opts = {}) {
  const token = getToken();
  const headers = {
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const r = await fetch(path, { ...opts, headers });
  if (r.status === 401) {
    setToken('');
    location.hash = '#/pair';
  }
  return r;
}

export async function apiJson(path, opts) {
  const r = await api(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}
