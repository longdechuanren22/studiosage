const TOKEN_KEY = 'studiosage_token';
const TOKEN_TS_KEY = 'studiosage_token_ts';

function getToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    // Warn if token will expire soon (6 days into 7-day validity)
    const ts = parseInt(localStorage.getItem(TOKEN_TS_KEY) || '0');
    const age = Date.now() - ts;
    const sixDays = 6 * 24 * 3600 * 1000;
    if (age > sixDays && age < 7 * 24 * 3600 * 1000) {
      // Dispatch a custom event for the app to refresh the token
      window.dispatchEvent(new CustomEvent('token-expiring'));
    }
  }
  return token;
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_TS_KEY, String(Date.now()));
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_TS_KEY);
}

// Auto-refresh token when expiring
let _refreshPromise: Promise<void> | null = null;
async function tryRefreshToken(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise.then(() => true).catch(() => false);
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return false;
  _refreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      setToken(data.token);
    } finally { _refreshPromise = null; }
  })();
  try { await _refreshPromise; return true; } catch { return false; }
}

export interface RequestOptions { signal?: AbortSignal; }

async function request<T = any>(method: string, url: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: opts?.signal,
  });

  if (res.status === 401) {
    // Try token refresh once before giving up
    if (!url.includes('/api/auth/') && await tryRefreshToken()) {
      // Retry with new token
      const newToken = getToken();
      if (newToken) {
        const retryRes = await fetch(url, { method, headers: { ...headers, 'Authorization': `Bearer ${newToken}` }, body: body !== undefined ? JSON.stringify(body) : undefined, signal: opts?.signal });
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          return retryData as T;
        }
      }
    }
    clearToken();
    if (!url.includes('/api/auth/')) {
      window.location.replace('/sage/login');
      return new Promise(() => {});
    }
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error((data as any)?.error || `请求失败 (${res.status})`);
  return data as T;
}

export const api = {
  get<T = any>(url: string, opts?: RequestOptions): Promise<T> {
    return request('GET', url, undefined, opts);
  },
  post<T = any>(url: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return request('POST', url, body, opts);
  },
  patch<T = any>(url: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return request('PATCH', url, body, opts);
  },
  del<T = any>(url: string, opts?: RequestOptions): Promise<T> {
    return request('DELETE', url, undefined, opts);
  },
};
