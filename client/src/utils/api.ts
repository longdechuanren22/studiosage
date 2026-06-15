const TOKEN_KEY = 'studiosage_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
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
    // Redirect to login — preserve basename
    if (!url.includes('/api/auth/')) {
      window.location.href = '/sage/login';
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
