import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ text: JSON.stringify({
          category: 'normal',
          summary: 'Client asking about photo turnaround',
          suggestedReply: 'Hi! Your photos will be ready within 2 weeks. Want a sneak peek earlier?',
          confidence: 0.94,
          stage: 'post_production',
        }) }],
      }),
    },
  })),
}));

describe('AI Engine', () => {
  it('classifyMessage returns correct structure', async () => {
    const { classifyMessage } = await import('../ai/engine.js');
    const result = await classifyMessage(
      'Hi! Just wondering when the photos will be ready?',
      'Photo timeline question',
      { name: 'Sarah', stage: 'post_production', shootDate: '2026-06-01' }
    );

    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('suggestedReply');
    expect(result).toHaveProperty('confidence');
    expect(['urgent', 'normal', 'spam']).toContain(result.category);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('generateInvoiceData returns structured invoice', async () => {
    const { generateInvoiceData } = await import('../ai/engine.js');
    const result = await generateInvoiceData({
      photographerName: 'Emma',
      photographerEmail: 'emma@example.com',
      clientName: 'Sarah & Mike',
      clientEmail: 'sarah@example.com',
      packageType: 'wedding',
      amount: 3500,
      paymentSchedule: 'three-phase',
    });

    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('paymentSchedule');
    expect(result.paymentSchedule).toHaveLength(3);
  });
});

describe('API Routes', () => {
  it('GET /api/health returns ok', async () => {
    const res = await fetch('http://localhost:3001/api/health');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
  });
});
