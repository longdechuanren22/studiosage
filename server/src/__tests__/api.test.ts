import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock Anthropic to avoid real API calls
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn().mockResolvedValue({
      content: [{ text: JSON.stringify({ category: 'normal', summary: 'test', suggestedReply: 'test reply', confidence: 0.9, stage: 'post_production' }) }],
    }) },
  })),
}));

const BASE = 'http://localhost:3001';

describe('API Routes', () => {
  it('GET /api/health returns ok', async () => {
    const res = await fetch(`${BASE}/api/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('healthy');
  });

  it('GET /api/settings returns config status', async () => {
    const res = await fetch(`${BASE}/api/settings`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('ai');
    expect(json).toHaveProperty('setupComplete');
  });

  it('GET /api/dashboard returns stats', async () => {
    const res = await fetch(`${BASE}/api/dashboard`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('today');
    expect(json).toHaveProperty('clientsByStage');
  });

  it('GET /api/invoices returns list', async () => {
    const res = await fetch(`${BASE}/api/invoices`);
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('POST /api/messages/incoming validates body', async () => {
    const res = await fetch(`${BASE}/api/messages/incoming`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Test message from client' }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('category');
    expect(json).toHaveProperty('suggestedReply');
  });

  it('POST /api/invoices/generate creates invoice', async () => {
    const res = await fetch(`${BASE}/api/invoices/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: 'Test Client',
        clientEmail: 'test@example.com',
        packageType: 'wedding',
        amount: 3500,
        paymentSchedule: 'three-phase',
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('items');
    expect(json.paymentSchedule).toHaveLength(3);
  });
});
