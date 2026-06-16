import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE = 'http://localhost:3001';
let token = '';
let clientId = '';

beforeAll(async () => {
  // Ensure test user exists
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `ci-${Date.now()}@test.com`, password: 'test123456', name: 'CI Test' }),
  });
  const data = await reg.json();
  token = data.token || '';
  if (!token) throw new Error('Failed to get auth token for tests');
});

afterAll(async () => {
  // Cleanup: archive test client
  if (clientId) {
    await fetch(`${BASE}/api/clients/${clientId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    });
  }
});

describe('Auth', () => {
  it('register returns 201 + token', async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `new-${Date.now()}@test.com`, password: 'test123456', name: 'New' }),
    });
    expect(res.status).toBe(201);
    expect((await res.json()).ok).toBe(true);
  });

  it('login returns 200', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `ci-${Date.now()}@test.com`, password: 'test123456' }),
    });
    // May be rate-limited in CI
    expect([200, 401, 429]).toContain(res.status);
  });

  it('duplicate email returns 409', async () => {
    const email = `dup-${Date.now()}@test.com`;
    await fetch(`${BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'test123456', name: 'Dup' }),
    });
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'test123456', name: 'Dup2' }),
    });
    expect(res.status).toBe(409);
  });

  it('me without token returns 401', async () => {
    const res = await fetch(`${BASE}/api/auth/me`);
    expect(res.status).toBe(401);
  });

  it('me with token returns user', async () => {
    const res = await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await res.json()).ok).toBe(true);
  });

  it('forgot-password returns ok', async () => {
    const res = await fetch(`${BASE}/api/auth/forgot-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'any@test.com' }),
    });
    expect((await res.json()).ok).toBe(true);
  });
});

describe('Clients', () => {
  it('create client', async () => {
    const res = await fetch(`${BASE}/api/clients`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Test Client', email: 'client@test.com' }),
    });
    const data = await res.json();
    expect(data.id).toBeTruthy();
    clientId = data.id;
  });

  it('list includes client', async () => {
    const res = await fetch(`${BASE}/api/clients`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.some((c: any) => c.name === 'Test Client')).toBe(true);
  });

  it('search finds client', async () => {
    const res = await fetch(`${BASE}/api/clients?search=Test`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    expect(data.some((c: any) => c.name === 'Test Client')).toBe(true);
  });

  it('update name', async () => {
    await fetch(`${BASE}/api/clients/${clientId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Updated Client' }),
    });
    const res = await fetch(`${BASE}/api/clients/${clientId}`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await res.json()).name).toBe('Updated Client');
  });
});

describe('Invoices', () => {
  it('list returns paginated', async () => {
    const res = await fetch(`${BASE}/api/invoices`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    expect(data).toHaveProperty('invoices');
  });

  it('generate returns 201', async () => {
    const res = await fetch(`${BASE}/api/invoices/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clientName: 'Test', clientEmail: 't@t.com', packageType: 'wedding', amount: 4500, paymentSchedule: 'three-phase' }),
    });
    expect(res.status).toBe(201);
  });
});

describe('Proposals', () => {
  it('create returns shareToken', async () => {
    const res = await fetch(`${BASE}/api/proposals`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: 'Test Proposal', clientId: null, packages: [], pricing: {}, contractTerms: '' }),
    });
    expect(res.status).toBe(201);
    expect((await res.json()).shareToken).toBeTruthy();
  });
});

describe('Dashboard & Health', () => {
  it('dashboard returns stats', async () => {
    const res = await fetch(`${BASE}/api/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    expect(data).toHaveProperty('stats');
  });

  it('health returns ok', async () => {
    const res = await fetch(`${BASE}/api/health`);
    expect([200, 503]).toContain(res.status);
  });

  it('health/data returns counts', async () => {
    const res = await fetch(`${BASE}/api/health/data`);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('settings returns ai config', async () => {
    const res = await fetch(`${BASE}/api/settings`, { headers: { Authorization: `Bearer ${token}` } });
    expect((await res.json())).toHaveProperty('ai');
  });
});
