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
  // 🔒 安全：发票金额是合同——AI 不构造合同内容，完全用离线模板
  return generateInvoiceOffline(params);
}

// ── 选片→修图→交付 AI 智能化 ──

const REVISION_TYPES = ['exposure', 'color', 'crop', 'blemish', 'background', 'other'] as const;
type RevisionType = typeof REVISION_TYPES[number];

interface RevisionClassifyResult {
  revisionType: RevisionType;
  confidence: number;
}

/**
 * AI 修改类型识别 — 客户写"亮一点"→自动归类为 exposure
 * Falls back to keyword matching when AI unavailable
 */
export async function classifyRevisionType(description: string): Promise<RevisionClassifyResult> {
  if (!USE_AI || !description?.trim()) return classifyRevisionOffline(description);

  try {
    const prompt = `You are a photo editing assistant. Classify this client's revision request into one type: exposure(曝光), color(色调), crop(裁剪), blemish(去瑕疵), background(背景), other(其他).

Client description: "${description.slice(0, 300)}"

Output JSON only: {"revisionType":"...","confidence":0.X}`;

    const text = await callAI(prompt, 120, 0.1);
    const result = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, ''));
    if (REVISION_TYPES.includes(result.revisionType)) {
      return { revisionType: result.revisionType, confidence: result.confidence || 0.8 };
    }
    return classifyRevisionOffline(description);
  } catch (err) {
    console.error('[AI] classifyRevisionType failed:', (err as Error).message);
    return classifyRevisionOffline(description);
  }
}

function classifyRevisionOffline(description: string): RevisionClassifyResult {
  const d = (description || '').toLowerCase();
  if (/亮|暗|曝光|太黑|太白|过曝|欠曝|lighter|darker|exposure|bright|dark/i.test(d)) return { revisionType: 'exposure', confidence: 0.85 };
  if (/色|调|暖|冷|白平衡|偏黄|偏蓝|color|warm|cool|tone|white balance/i.test(d)) return { revisionType: 'color', confidence: 0.85 };
  if (/裁|剪|切|crop|trim|cut/i.test(d)) return { revisionType: 'crop', confidence: 0.85 };
  if (/瑕疵|痘|斑|皱纹|去|修|blemish|spot|wrinkle|smooth|remove/i.test(d)) return { revisionType: 'blemish', confidence: 0.8 };
  if (/背景|换|替换|后面|background|replace/i.test(d)) return { revisionType: 'background', confidence: 0.8 };
  return { revisionType: 'other', confidence: 0.5 };
}

interface RevisionRecord {
  description: string;
  revisionType: string;
  roundNumber: number;
}

interface ConflictResult {
  hasConflict: boolean;
  description: string;
}

/**
 * AI 修改冲突检测 — Round 1 说"暖色调"，Round 2 说"太暖了，要冷色"
 * Falls back to keyword overlap when AI unavailable
 */
export async function detectRevisionConflict(
  previousRevisions: RevisionRecord[],
  newDescription: string,
  newType: string
): Promise<ConflictResult> {
  if (!previousRevisions.length) return { hasConflict: false, description: '' };

  if (!USE_AI) return detectConflictOffline(previousRevisions, newDescription, newType);

  try {
    const prevSummary = previousRevisions.map(r =>
      `[Round ${r.roundNumber}] type=${r.revisionType}: "${r.description}"`
    ).join('\n');

    const prompt = `You are checking for conflicting revision requests across editing rounds. A conflict means the client is asking for something that contradicts a previous request.

Previous revisions:
${prevSummary}

New revision: type=${newType}, description="${newDescription.slice(0, 300)}"

Does this new revision directly contradict any previous revision? (e.g., "Round 1: warmer tones" vs "Round 2: too warm, make it cooler" = CONFLICT)

Output JSON only: {"hasConflict":true|false,"description":"brief explanation if conflict, or empty string"}`;

    const text = await callAI(prompt, 200, 0.1);
    const result = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, ''));
    return {
      hasConflict: !!result.hasConflict,
      description: result.description || '',
    };
  } catch (err) {
    console.error('[AI] detectRevisionConflict failed:', (err as Error).message);
    return detectConflictOffline(previousRevisions, newDescription, newType);
  }
}

function detectConflictOffline(prev: RevisionRecord[], newDesc: string, newType: string): ConflictResult {
  const sameTypeRevs = prev.filter(r => r.revisionType === newType);
  if (!sameTypeRevs.length) return { hasConflict: false, description: '' };

  // Simple keyword-based conflict: opposite tone words
  const newLower = newDesc.toLowerCase();
  const opposites: [RegExp, RegExp, string][] = [
    [/warm|暖|黄/, /cool|冷|蓝/, '色调方向冲突：之前要求偏暖，现在要求偏冷'],
    [/bright|亮|light/i, /dark|暗/i, '曝光方向冲突：之前要求调亮，现在要求调暗'],
    [/crop.*tight|close.*up|裁.*紧/i, /wide|full.*body|全身/i, '裁剪方向冲突'],
  ];

  for (const rev of sameTypeRevs) {
    for (const [patA, patB, msg] of opposites) {
      const prevMatch = patA.test(rev.description) || patB.test(rev.description);
      const newMatch = patA.test(newLower) || patB.test(newLower);
      if (prevMatch && newMatch) {
        // Check if they're on opposite sides
        const prevSide = patA.test(rev.description) ? 'A' : 'B';
        const newSide = patA.test(newLower) ? 'A' : 'B';
        if (prevSide !== newSide) {
          return { hasConflict: true, description: msg };
        }
      }
    }
  }
  return { hasConflict: false, description: '' };
}

// ── AI 催款话术 —— #2 情感痛点：催款不尴尬 ──

interface PaymentContext {
  clientName: string;
  projectTitle: string;
  amount: number;
  currency?: string;
  daysOverdue: number;        // 0 = not overdue yet (friendly reminder), 7+ = formal, 30+ = final notice
  paymentType: 'retainer' | 'installment' | 'final';
}

/**
 * AI 催款话术生成 — 按逾期天数分三级语气
 * 0天=友情提醒, 7天=正式催收, 30天=最后通牒
 * Falls back to templates when AI unavailable
 */
export async function draftPaymentReminder(ctx: PaymentContext): Promise<string> {
  if (!USE_AI) return draftPaymentTemplate(ctx);

  try {
    const urgency = ctx.daysOverdue <= 0 ? 'friendly reminder before due date'
      : ctx.daysOverdue <= 7 ? 'polite but firm payment request, 7 days overdue'
      : ctx.daysOverdue <= 30 ? 'formal payment demand, getting serious'
      : 'final notice before potential legal action';

    const prompt = `You are a photographer reminding a client about a payment. The key requirement: maintain professionalism and warmth — NEVER sound like debt collection.

Context:
- Client: ${ctx.clientName}
- Project: ${ctx.projectTitle}
- Payment type: ${ctx.paymentType}
- Days since due: ${ctx.daysOverdue} (${urgency})

Write a ${urgency} message in Chinese. Rules:
- Keep under 100 characters
- Never use aggressive language (讨债语气)
- Frame it as a "friendly reminder" even when late
- Use [金额] as a placeholder for the payment amount (do NOT write a specific number)
- End with [摄影师姓名]

Output the message text only, no JSON.`;

    const text = await callAI(prompt, 250, 0.5);
    // 🔒 安全：AI 不直接写金额。金额从 DB 取，替换 AI 的占位符
    return text.trim().replace('[金额]', `${ctx.currency || '¥'}${ctx.amount}`);
  } catch (err) {
    console.error('[AI] draftPaymentReminder failed:', (err as Error).message);
    return draftPaymentTemplate(ctx);
  }
}

function draftPaymentTemplate(ctx: PaymentContext): string {
  const amount = `${ctx.currency || '¥'}${ctx.amount}`;
  if (ctx.daysOverdue <= 0) {
    return `${ctx.clientName} 您好，${ctx.projectTitle}的${ctx.paymentType === 'retainer' ? '定金' : '尾款'}${amount}即将到期，方便时请完成支付。如有疑问随时联系我。[摄影师姓名]`;
  } else if (ctx.daysOverdue <= 7) {
    return `${ctx.clientName} 您好，${ctx.projectTitle}的${amount}已逾期${ctx.daysOverdue}天，方便时请安排一下，谢谢！[摄影师姓名]`;
  } else if (ctx.daysOverdue <= 30) {
    return `${ctx.clientName} 您好，关于${ctx.projectTitle}的${amount}已逾期${ctx.daysOverdue}天，还请尽快安排支付。如果遇到困难可以说一声，我们商量解决方案。[摄影师姓名]`;
  } else {
    return `${ctx.clientName} 您好，${ctx.projectTitle}的${amount}已严重逾期${ctx.daysOverdue}天。如本周内未收到款项，将暂停后续服务。如有特殊情况请及时沟通。[摄影师姓名]`;
  }
}

// ── AI 修改具体性门卫 —— #1 情感痛点：防止"不好看，重做" ──

interface ClarityResult {
  isSpecific: boolean;
  rejectionReason?: string;    // if not specific, what to tell the client
  suggestedType?: RevisionType; // if specific, auto-classify
}

/**
 * AI 判断修改描述是否足够具体
 * "亮一点" → ✅ specific
 * "不好看，重做" → ❌ rejected with guidance
 * "瘦一点→太瘦了" → ⚠️ subjective, asked to clarify
 */
export async function validateRevisionClarity(description: string): Promise<ClarityResult> {
  if (!description?.trim()) return { isSpecific: false, rejectionReason: '请填写修改描述' };
  if (description.trim().length < 2) return { isSpecific: false, rejectionReason: '修改描述太短，请至少写5个字说明需要改哪里' };

  if (!USE_AI) return validateClarityOffline(description);

  try {
    const prompt = `You are a photo editing assistant. A client has requested a revision on a photo. Your job: judge whether the description is SPECIFIC enough to act on.

Client description: "${description.slice(0, 300)}"

Rules for specificity:
- SPECIFIC ✅: "亮度提高一点", "背景左边那个人去掉", "色调偏暖一点", "裁掉右下角的杂物"
- NOT SPECIFIC ❌: "不好看", "重做", "感觉不对", "不是我想要的效果", "再修一下", "这张不好"
- SUBJECTIVE ⚠️: "瘦一点", "眼睛大一点" (physically altering body features is subjective and may loop forever)

Also auto-classify into: exposure(曝光), color(色调), crop(裁剪), blemish(去瑕疵), background(背景), other(其他)

Output JSON only: {"isSpecific":true|false,"rejectionReason":"(if not specific, a polite message in Chinese asking for more detail, under 50 chars)","suggestedType":"exposure|color|crop|blemish|background|other"}`;

    const text = await callAI(prompt, 200, 0.1);
    const result = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, ''));
    return {
      isSpecific: !!result.isSpecific,
      rejectionReason: result.rejectionReason || undefined,
      suggestedType: REVISION_TYPES.includes(result.suggestedType) ? result.suggestedType : undefined,
    };
  } catch (err) {
    console.error('[AI] validateRevisionClarity failed:', (err as Error).message);
    return validateClarityOffline(description);
  }
}

function validateClarityOffline(description: string): ClarityResult {
  const d = description.trim();
  // Vague rejection patterns
  if (/^(不好看|重做|重拍|重P|不好|不行|不对|感觉不对|不是我想要|差点意思|再修|再改)$/i.test(d)) {
    return { isSpecific: false, rejectionReason: '请具体说明需要调整哪里，例如："亮度提高一点"、"色调偏暖一些"、"背景的杂物去掉"' };
  }
  if (d.length < 5) {
    return { isSpecific: false, rejectionReason: '描述太短，请补充具体修改内容，例如："整体亮度提高，人物面部调亮"' };
  }
  // Vague with some detail
  if (/瘦|胖|美|丑|好看|难看/i.test(d) && d.length < 15) {
    return { isSpecific: false, rejectionReason: '关于人物外观的修改较为主观，请描述具体哪里需要调整，如："脸部下颌线收一点"' };
  }
  // Looks specific enough — classify
  return { isSpecific: true, suggestedType: classifyRevisionOffline(d).revisionType };
}
