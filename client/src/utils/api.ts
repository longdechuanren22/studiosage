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
      // Dispatch a custom event for the app to show a warning
      window.dispatchEvent(new CustomEvent('token-expiring'));
    }
  }
  return token;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    if (!url.includes('/api/auth/')) {
      // Immediate redirect — stop all further execution
      window.location.replace('/sage/login');
      // Never resolve — prevent any further code execution
      return new Promise(() => {});
    }
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error((data as any)?.error || `请求失败 (${res.status})`);
  return data as T;
}

export const api = {
  get<T = any>(url: string): Promise<T> {
    return request('GET', url);
  },
  post<T = any>(url: string, body?: unknown): Promise<T> {
    return request('POST', url, body);
  },
  patch<T = any>(url: string, body?: unknown): Promise<T> {
    return request('PATCH', url, body);
  },
  del<T = any>(url: string): Promise<T> {
    return request('DELETE', url);
  },
};
