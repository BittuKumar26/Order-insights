import { token } from '../auth';

const BASE = import.meta.env.VITE_API_URL || '/api';

export const qs = (params = {}) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    const headers = {};
    const authToken = token();
    if (authToken) headers.Authorization = 'Bearer ' + authToken;
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    res = await fetch(`${BASE}${path}`, {
      method,
      body: body && !(body instanceof FormData) ? JSON.stringify(body) : body,
      signal,
      headers,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('Cannot reach the API. Is the server running on port 5000?');
  }
  let json = null;
  try { json = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok || json?.success === false) throw new Error(json?.error?.message || `Request failed (${res.status})`);
  return json;
}

export const api = {
  get: (path, params, signal) => request(`${path}${qs(params)}`, { signal }),
  post: (path, body) => request(path, { method: 'POST', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  upload: (path, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request(path, { method: 'POST', body: fd });
  },
};
