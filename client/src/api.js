// All calls to the backend go through here.
const BASE = import.meta.env.VITE_API_URL || ''; // '' = same origin (Vite proxies /api in dev)

export const getToken = () => localStorage.getItem('kg_token');
export const setToken = (t) => (t ? localStorage.setItem('kg_token', t) : localStorage.removeItem('kg_token'));

async function request(method, path, body) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'error'), { code: data.error, status: res.status });
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b || {}),
  patch: (p, b) => request('PATCH', p, b),
  del: (p, b) => request('DELETE', p, b),
};
