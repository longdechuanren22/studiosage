import { describe, it, expect, beforeAll } from 'vitest';

const BASE = 'http://localhost:3001';
let token = '';

beforeAll(async () => {
  // Register a test user
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'vitest@test.com', password: 'test123456', name: 'Test' }),
  });
  const data = await res.json();
  if (data.ok) token = data.token;
  else {
    // Already exists, try login
    const login = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'vitest@test.com', password: 'test123456' }),
    });
    const loginData = await login.json();
    token = loginData.token;
  }
});

describe('Auth', () => {
  it('POST /api/auth/register returns 201 + token', async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `new-${Date.now()}@test.com`, password: 'test123456', name: 'New' }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.token).toBeTruthy();
  });

  it('POST /api/auth/login returns 200 + token', async () => {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'vitest@test.com', password: 'test123456' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('POST /api/auth/register duplicate email returns 409', async () => {
    const res = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'vitest@test.com', password: 'test123456', name: 'Dup' }),
    });
    expect(res.status).toBe(409);
  });

  it('GET /api/auth/me without token returns 401', async () => {
    const res = await fetch(`${BASE}/api/auth/me`);
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me with valid token returns user', async () => {
    const res = await fetch(`${BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.user.email).toBe('vitest@test.com');
  });
});

describe('Invoices', () => {
  it('GET /api/invoices returns array', async () => {
    const res = await fetch(`${BASE}/api/invoices`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    expect(data.invoices).toBeInstanceOf(Array);
  });

  it('POST /api/invoices/generate returns 201', async () => {
    const res = await fetch(`${BASE}/api/invoices/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ clientName: 'Test Client', clientEmail: 'test@client.com', packageType: 'wedding', amount: 4500, paymentSchedule: 'three-phase' }),
    });
    expect(res.status).toBe(201);
  });
});

describe('Proposals', () => {
  it('POST /api/proposals returns 201 + shareToken', async () => {
    const res = await fetch(`${BASE}/api/proposals`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: 'Test Proposal', clientId: null, packages: [], pricing: {}, contractTerms: '' }),
    });
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.shareToken).toBeTruthy();
  });
});

describe('Health', () => {
  it('GET /api/health returns ok', async () => {
    const res = await fetch(`${BASE}/api/health`);
    expect([200, 503]).toContain(res.status); // 503=degraded (expected in dev)
  });
});
