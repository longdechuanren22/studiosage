// AI Engine — multi-model with graceful fallback
// Priority: Claude > DeepSeek > offline rules
import { classifyOffline, generateInvoiceOffline } from './rules-engine.js';

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const USE_AI = !!(DEEPSEEK_KEY || ANTHROPIC_KEY);

// Track which model is active
let activeModel: 'claude' | 'deepseek' | 'offline' = 'offline';
let consecutiveFailures = 0;

export function getAIStatus() {
  return {
    active: USE_AI,
    model: activeModel,
    providers: {
      claude: !!ANTHROPIC_KEY,
      deepseek: !!DEEPSEEK_KEY,
    },
    consecutiveFailures,
    fallback: !USE_AI || consecutiveFailures >= 3,
  };
}

interface ClientContext { name?: string; stage?: string; shootDate?: string; packageType?: string; galleryUploaded?: number; galleryTotal?: number; pendingInvoices?: number; }

interface ClassifyResult { category: 'urgent' | 'normal' | 'spam'; summary: string; suggestedReply: string; confidence: number; stage?: string; }

// Multi-model callAI: tries Claude then DeepSeek
export async function callAI(prompt: string, maxTokens = 600, temp = 0.3): Promise<string> {
  // Try Claude first (better quality)
  if (ANTHROPIC_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, temperature: temp, messages: [{ role: 'user', content: prompt }] }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        activeModel = 'claude';
        consecutiveFailures = 0;
        return data.content[0].text;
      }
      console.error(`[AI] Claude returned ${res.status}, trying DeepSeek...`);
    } catch (err) {
      console.error(`[AI] Claude failed: ${(err as Error).message}, trying DeepSeek...`);
    }
  }

  // Try DeepSeek
  if (DEEPSEEK_KEY) {
    try {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: temp }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        activeModel = 'deepseek';
        consecutiveFailures = 0;
        return data.choices[0].message.content;
      }
      console.error(`[AI] DeepSeek returned ${res.status}`);
    } catch (err) {
      console.error(`[AI] DeepSeek failed: ${(err as Error).message}`);
    }
  }

  consecutiveFailures++;
  activeModel = 'offline';
  throw new Error('All AI providers unavailable');
}

export async function classifyMessage(body: string, subject: string, ctx?: ClientContext): Promise<ClassifyResult> {
  if (!USE_AI) return classifyOffline(body, subject, ctx);
  try {
    const stageInfo = ctx ? `Client: ${ctx.name || 'Unknown'}, Stage: ${ctx.stage || '?'}, Gallery: ${ctx.galleryUploaded || 0}/${ctx.galleryTotal || 0}` : 'No context';
    const prompt = `Classify this photography client message. Context: ${stageInfo}\nSubject: "${subject}"\nMessage: "${body}"\nOutput JSON: {"category":"urgent|normal|spam","summary":"...","suggestedReply":"...","confidence":0.X,"stage":"inquiry|...|post_delivery"}`;
    const text = await callAI(prompt, 600, 0.3);
    return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, ''));
  } catch (err) {
    console.error('[AI] classifyMessage failed, using offline:', (err as Error).message);
    return classifyOffline(body, subject, ctx);
  }
}

export interface GenerateInvoiceParams {
  photographerName: string; photographerEmail: string;
  clientName: string; clientEmail: string;
  packageType: string; amount: number;
  currency?: string; paymentSchedule?: 'single' | 'three-phase';
  additionalNotes?: string;
}

export async function generateInvoiceData(params: GenerateInvoiceParams) {
  if (!USE_AI) return generateInvoiceOffline(params);
  try {
    const prompt = `Generate photography invoice JSON. Input: ${JSON.stringify(params)}. Include line items, retainer label, 3-phase schedule if applicable.`;
    const text = await callAI(prompt, 500, 0.2);
    return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, ''));
  } catch (err) {
    console.error('[AI] generateInvoiceData failed, using offline:', (err as Error).message);
    return generateInvoiceOffline(params);
  }
}
