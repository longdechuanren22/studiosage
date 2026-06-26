// AI Engine — multi-model with graceful fallback
// Priority: Claude > DeepSeek > offline rules
import { classifyOffline, generateInvoiceOffline } from './rules-engine.js';
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const USE_AI = !!(DEEPSEEK_KEY || ANTHROPIC_KEY);
// Track which model is active
let activeModel = 'offline';
let consecutiveFailures = 0;
let lastFailureAt = 0;
const AI_RECOVERY_COOLDOWN_MS = 300_000; // 5 minutes
export function getAIStatus() {
    // Auto-recover: if enough time has passed since last failure, try AI again
    if (consecutiveFailures >= 3 && lastFailureAt > 0 && Date.now() - lastFailureAt > AI_RECOVERY_COOLDOWN_MS) {
        consecutiveFailures = 0;
        lastFailureAt = 0;
        activeModel = 'offline';
    }
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
// Multi-model callAI: tries Claude then DeepSeek
export async function callAI(prompt, maxTokens = 600, temp = 0.3) {
    // Try Claude first (better quality)
    if (ANTHROPIC_KEY) {
        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
                body: JSON.stringify({ model: process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001', max_tokens: maxTokens, temperature: temp, messages: [{ role: 'user', content: prompt }] }),
            });
            if (res.ok) {
                const data = await res.json();
                activeModel = 'claude';
                consecutiveFailures = 0;
                lastFailureAt = 0;
                return data.content[0].text;
            }
            console.error(`[AI] Claude returned ${res.status}, trying DeepSeek...`);
        }
        catch (err) {
            console.error(`[AI] Claude failed: ${err.message}, trying DeepSeek...`);
        }
    }
    // Try DeepSeek
    if (DEEPSEEK_KEY) {
        try {
            const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
                body: JSON.stringify({ model: process.env.DEEPSEEK_MODEL || 'deepseek-chat', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: temp }),
            });
            if (res.ok) {
                const data = await res.json();
                activeModel = 'deepseek';
                consecutiveFailures = 0;
                lastFailureAt = 0;
                return data.choices[0].message.content;
            }
            console.error(`[AI] DeepSeek returned ${res.status}`);
        }
        catch (err) {
            console.error(`[AI] DeepSeek failed: ${err.message}`);
        }
    }
    consecutiveFailures++;
    lastFailureAt = Date.now();
    activeModel = 'offline';
    throw new Error('All AI providers unavailable');
}
export async function classifyMessage(body, subject, ctx) {
    if (!USE_AI)
        return classifyOffline(body, subject, ctx);
    // Build multi-turn conversation memory for context-aware replies
    let memoryBlock = '';
    if (ctx?.conversationMemory) {
        const m = ctx.conversationMemory;
        memoryBlock = [
            `Conversation history: ${m.messageCount} messages total.`,
            m.recentSubjects.length ? `Recent topics: ${m.recentSubjects.join(' | ')}` : '',
            m.lastReplyAt ? `Photographer last replied: ${m.lastReplyAt}` : 'No reply sent yet.',
            m.pendingSince ? `⛔ Client has been waiting since ${m.pendingSince} — needs reply.` : '',
        ].filter(Boolean).join('\n');
    }
    const stageInfo = ctx
        ? `Client: ${ctx.name || 'Unknown'}, Stage: ${ctx.stage || '?'}, Gallery: ${ctx.galleryUploaded || 0}/${ctx.galleryTotal || 0}`
        : 'No context';
    const prompt = `You are an AI assistant for a professional photographer. Analyze this client message:

${memoryBlock}

Client context: ${stageInfo}
Subject: "${subject}"
Message: "${body.slice(0, 3000)}"

Return a JSON object:
{
  "category": "urgent" | "normal" | "spam",
  "summary": "1-line summary in English",
  "suggestedReply": "Professional, warm reply as if from the photographer. Keep under 150 chars.",
  "confidence": 0.0-1.0,
  "stage": "inquiry|engaged|booked|shooting|production|delivery|post_delivery",
  "sentiment": "positive" | "neutral" | "anxious" | "frustrated" | "urgent",
  "pricingIntent": true|false,
  "needsImmediateAttention": true|false
}

Guidelines:
- sentiment: "frustrated" if client seems upset/angry. "anxious" if worried about deadlines. "urgent" if time-critical.
- pricingIntent: true if client is asking about prices, packages, or "how much"
- needsImmediateAttention: true if sentiment is frustrated/urgent OR client has been waiting >48h
- suggestedReply: if pricingIntent is true, don't quote prices. Instead offer to prepare a custom proposal.
- Use conversation history to avoid repeating information the client already knows.`;
    try {
        const text = await callAI(prompt, 800, 0.3);
        return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, ''));
    }
    catch (err) {
        console.error('[AI] classifyMessage failed, using offline:', err.message);
        return classifyOffline(body, subject, ctx);
    }
}
export async function generateInvoiceData(params) {
    // 🔒 安全：金额和支付条款来自用户输入，AI 只生成行项目描述和发票备注
    if (!USE_AI)
        return generateInvoiceOffline(params);
    try {
        const prompt = `You are a photography invoice assistant. Generate line items and a professional invoice description based on the package type.

Package: ${params.packageType}
Amount: ${params.currency || 'USD'} ${params.amount}
Client: ${params.clientName}
Notes: ${params.additionalNotes || 'none'}

Output ONLY valid JSON with:
{
  "description": "Professional invoice title (e.g. 'Wedding Photography — Full Day Coverage')",
  "items": [
    {"description": "Line item description", "unitPrice": ${params.amount}, "quantity": 1}
  ],
  "retainerLabel": null or "Non-refundable retainer" if applicable
}

Keep line items concise. Total of all items must equal exactly ${params.amount}. Output JSON only, no markdown.`;
        const text = await callAI(prompt, 250, 0.3);
        const result = JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim());
        // Validate total matches user's amount
        const items = result.items || [];
        const total = items.reduce((sum, item) => sum + ((item.unitPrice || 0) * (item.quantity || 1)), 0);
        if (Math.abs(total - params.amount) > 0.01) {
            // AI amount mismatch — fix items to match user amount
            if (items.length > 0) {
                items[0].unitPrice = params.amount;
                items[0].quantity = 1;
            }
        }
        return {
            description: result.description || `${params.packageType} — ${params.clientName}`,
            items: items.length > 0 ? items : generateInvoiceOffline(params).items,
            retainerLabel: result.retainerLabel || null,
        };
    }
    catch (err) {
        console.error('[AI] generateInvoiceData failed, using offline:', err.message);
        return generateInvoiceOffline(params);
    }
}
// ── 选片→修图→交付 AI 智能化 ──
const REVISION_TYPES = ['exposure', 'color', 'crop', 'blemish', 'background', 'other'];
/**
 * AI 修改类型识别 — 客户写"亮一点"→自动归类为 exposure
 * Falls back to keyword matching when AI unavailable
 */
export async function classifyRevisionType(description) {
    if (!USE_AI || !description?.trim())
        return classifyRevisionOffline(description);
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
    }
    catch (err) {
        console.error('[AI] classifyRevisionType failed:', err.message);
        return classifyRevisionOffline(description);
    }
}
function classifyRevisionOffline(description) {
    const d = (description || '').toLowerCase();
    if (/亮|暗|曝光|太黑|太白|过曝|欠曝|lighter|darker|exposure|bright|dark/i.test(d))
        return { revisionType: 'exposure', confidence: 0.85 };
    if (/色|调|暖|冷|白平衡|偏黄|偏蓝|color|warm|cool|tone|white balance/i.test(d))
        return { revisionType: 'color', confidence: 0.85 };
    if (/裁|剪|切|crop|trim|cut/i.test(d))
        return { revisionType: 'crop', confidence: 0.85 };
    if (/瑕疵|痘|斑|皱纹|去|修|blemish|spot|wrinkle|smooth|remove/i.test(d))
        return { revisionType: 'blemish', confidence: 0.8 };
    if (/背景|换|替换|后面|background|replace/i.test(d))
        return { revisionType: 'background', confidence: 0.8 };
    return { revisionType: 'other', confidence: 0.5 };
}
/**
 * AI 修改冲突检测 — Round 1 说"暖色调"，Round 2 说"太暖了，要冷色"
 * Falls back to keyword overlap when AI unavailable
 */
export async function detectRevisionConflict(previousRevisions, newDescription, newType) {
    if (!previousRevisions.length)
        return { hasConflict: false, description: '' };
    if (!USE_AI)
        return detectConflictOffline(previousRevisions, newDescription, newType);
    try {
        const prevSummary = previousRevisions.map(r => `[Round ${r.roundNumber}] type=${r.revisionType}: "${r.description}"`).join('\n');
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
    }
    catch (err) {
        console.error('[AI] detectRevisionConflict failed:', err.message);
        return detectConflictOffline(previousRevisions, newDescription, newType);
    }
}
function detectConflictOffline(prev, newDesc, newType) {
    const sameTypeRevs = prev.filter(r => r.revisionType === newType);
    if (!sameTypeRevs.length)
        return { hasConflict: false, description: '' };
    // Simple keyword-based conflict: opposite tone words
    const newLower = newDesc.toLowerCase();
    const opposites = [
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
/**
 * AI 催款话术生成 — 按逾期天数分三级语气
 * 0天=友情提醒, 7天=正式催收, 30天=最后通牒
 * Falls back to templates when AI unavailable
 */
export async function draftPaymentReminder(ctx) {
    if (!USE_AI)
        return draftPaymentTemplate(ctx);
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
        // 🔒 安全：金额来自 DB。替换 AI 占位符，若 AI 漏写则追加
        const amountStr = `${ctx.currency || '¥'}${ctx.amount}`;
        let result = text.trim();
        if (result.includes('[金额]')) {
            result = result.replace('[金额]', amountStr);
        }
        else if (!result.includes(String(ctx.amount))) {
            result = `${result}（${amountStr}）`;
        }
        return result;
    }
    catch (err) {
        console.error('[AI] draftPaymentReminder failed:', err.message);
        return draftPaymentTemplate(ctx);
    }
}
function draftPaymentTemplate(ctx) {
    const amount = `${ctx.currency || '¥'}${ctx.amount}`;
    if (ctx.daysOverdue <= 0) {
        return `${ctx.clientName} 您好，${ctx.projectTitle}的${ctx.paymentType === 'retainer' ? '定金' : '尾款'}${amount}即将到期，方便时请完成支付。如有疑问随时联系我。[摄影师姓名]`;
    }
    else if (ctx.daysOverdue <= 7) {
        return `${ctx.clientName} 您好，${ctx.projectTitle}的${amount}已逾期${ctx.daysOverdue}天，方便时请安排一下，谢谢！[摄影师姓名]`;
    }
    else if (ctx.daysOverdue <= 30) {
        return `${ctx.clientName} 您好，关于${ctx.projectTitle}的${amount}已逾期${ctx.daysOverdue}天，还请尽快安排支付。如果遇到困难可以说一声，我们商量解决方案。[摄影师姓名]`;
    }
    else {
        return `${ctx.clientName} 您好，${ctx.projectTitle}的${amount}已严重逾期${ctx.daysOverdue}天。如本周内未收到款项，将暂停后续服务。如有特殊情况请及时沟通。[摄影师姓名]`;
    }
}
/**
 * AI 判断修改描述是否足够具体
 * "亮一点" → ✅ specific
 * "不好看，重做" → ❌ rejected with guidance
 * "瘦一点→太瘦了" → ⚠️ subjective, asked to clarify
 */
export async function validateRevisionClarity(description) {
    if (!description?.trim())
        return { isSpecific: false, rejectionReason: '请填写修改描述' };
    if (description.trim().length < 2)
        return { isSpecific: false, rejectionReason: '修改描述太短，请至少写5个字说明需要改哪里' };
    if (!USE_AI)
        return validateClarityOffline(description);
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
    }
    catch (err) {
        console.error('[AI] validateRevisionClarity failed:', err.message);
        return validateClarityOffline(description);
    }
}
function validateClarityOffline(description) {
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
// ── 非业务邮件识别 — 不属于摄影业务的邮件直接过滤 ──
const NON_BUSINESS_PATTERNS = [
    // 社交媒体通知
    /facebook.*(notif|mention|follow|like|comment|friend|request)/i,
    /instagram.*(notif|mention|follow|like|comment|story)/i,
    /linkedin.*(invitation|connect|request|notif|viewed|appeared)/i,
    /twitter.*(notif|mention|follow|retweet)/i,
    /tiktok.*(notif|message|follow)/i,
    /pinterest.*(notif|pin|board)/i,
    /snapchat/i,
    // 银行/金融
    /bank.*statement|transaction.*alert|balance.*update|credit.*card.*statement/i,
    /paypal.*receipt|venmo.*notif|cash.*app.*notif/i,
    /your.*bill.*is.*ready|payment.*received.*thank/i,
    // 快递/订单
    /order.*confirm|ship.*confirm|tracking.*number|your.*order.*#/i,
    /amazon\.com.*order|package.*delivered|delivery.*update/i,
    /receipt.*from|thank.*you.*for.*your.*purchase|invoice.*#/i,
    // 软件订阅
    /subscription.*renew|your.*subscription|trial.*ending|plan.*upgrade/i,
    /billing.*receipt|payment.*receipt.*#/i,
    // 垃圾/广告
    /newsletter|weekly.*digest|monthly.*roundup|webinar|free.*ebook/i,
    /limited.*time.*offer|act.*now|don't.*miss.*out|exclusive.*deal/i,
    /sale.*off|discount.*code|promo.*code|clearance/i,
    /SEO.*audit|backlink|guest.*post|sponsor|traffic.*to.*your/i,
    // 系统通知
    /password.*reset.*request|verify.*your.*email|confirm.*your.*account/i,
    /security.*alert.*login|new.*sign.*in|unusual.*activity/i,
    /do.*not.*reply.*automated|noreply|no-reply|donotreply/i,
    /mailer.*daemon|undelivered.*mail|delivery.*status.*notification/i,
    // 非摄影类咨询
    /website.*design|SEO.*services|app.*development|virtual.*assistant/i,
    /life.*insurance|health.*insurance|car.*insurance/i,
    // TikTok Shop /电商
    /tiktok.*shop|tiktok.*order|tiktok.*seller|etsy.*order|shopify.*order/i,
    /your.*shop.*order|new.*order.*#|order.*confirmed.*#/i,
    /aliexpress|temu|shein.*order|wish.*order/i,
];
export function isBusinessEmail(subject, body, fromAddress) {
    const text = (subject + ' ' + body.slice(0, 1000) + ' ' + fromAddress).toLowerCase();
    for (const pattern of NON_BUSINESS_PATTERNS) {
        if (pattern.test(text)) {
            return { isBusiness: false, reason: 'non-business notification or automated email' };
        }
    }
    // 🔄 修复：不再要求摄影关键词。来自个人邮箱的邮件一律视为潜在客户。
    const isPersonalSender = /@(gmail\.com|outlook\.com|yahoo\.com|hotmail\.com|qq\.com|163\.com|126\.com|icloud\.com|proton\.me|protonmail\.com|mail\.com|zoho\.com|fastmail\.com)$/i.test(fromAddress);
    if (isPersonalSender) {
        return { isBusiness: true };
    }
    // 企业域名 → 需要至少一个业务信号
    const bizSignals = [
        /photograph|photo|shoot|wedding|portrait|headshot/i,
        /picture|image|gallery|album|print|retouch|edit/i,
        /booking|schedule|date|availability|package|pricing|quote|rate/i,
        /contract|invoice|deposit|retainer/i,
        /bride|groom|ceremony|reception|engagement|elopement/i,
        /maternity|newborn|family.*photo|graduation/i,
        /\b拍摄\b|\b拍照\b|\b摄影\b|\b写真\b|\b婚纱\b|\b婚礼\b|\b跟拍\b/i,
        /\b修图\b|\b精修\b|\b底片\b|\b样片\b|\b选片\b/i,
        /how much|price|cost|available|inquiry|interest|services/i,
    ];
    if (bizSignals.some(p => p.test(text))) {
        return { isBusiness: true };
    }
    return { isBusiness: false, reason: 'corporate domain without photography-related content' };
}
/**
 * Extract photography-specific entities from client messages
 * Goes beyond budget/date to capture 服化道、风格、档期
 */
export function extractEnhancedEntities(subject, body) {
    const text = (subject + ' ' + body).toLowerCase();
    const entities = [];
    // ── 日期 ──
    const datePatterns = [
        /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,
        /(\d{1,2}月\d{1,2}[日号])/,
        /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}/i,
    ];
    for (const p of datePatterns) {
        const m = text.match(p);
        if (m) {
            entities.push({ type: 'date', value: m[1], confidence: 0.9 });
            break;
        }
    }
    // ── 时间/时段 ──
    const timePatterns = [
        /(\d{1,2}:\d{2})\s*(?:am|pm|上午|下午)?/i,
        /(?:早上|上午|中午|下午|傍晚|晚上)(\d{1,2}[点時])?/,
        /(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i,
    ];
    for (const p of timePatterns) {
        const m = text.match(p);
        if (m) {
            entities.push({ type: 'time', value: m[1] || m[0], confidence: 0.85 });
            break;
        }
    }
    // ── 服装 (Clothing) ──
    const clothingPatterns = [
        [/婚纱|wedding.*dress|白纱|礼服|gown|tuxedo|suit|西装|旗袍|汉服|和服/i, 'formal attire mentioned'],
        [/伴娘.*服|bridesmaid.*dress/i, 'bridesmaid dresses'],
        [/便装|causal|休闲/i, 'casual wear preferred'],
        [/多套.*衣服|换.*套|(\d+).*套.*衣服|(\d+).*outfits/i, '$1 outfits'],
    ];
    for (const [p, label] of clothingPatterns) {
        const m = text.match(p);
        if (m) {
            const value = label.replace(/\$(\d+)/g, (_, i) => m[parseInt(i)] || '');
            entities.push({ type: 'clothing', value, confidence: 0.8 });
            break;
        }
    }
    // ── 化妆造型 (Makeup) ──
    if (/化妆|makeup|造型|发型|hair.*stylist|妆面|粉底|眼影|口红/i.test(text)) {
        const detail = text.match(/化妆.*?(?:。|\.|$)|makeup.*?(?:\.|$)|造型.*?(?:。|\.|$)/i)?.[0] || 'makeup requested';
        entities.push({ type: 'makeup', value: detail.slice(0, 60), confidence: 0.8 });
    }
    // ── 道具 (Props) ──
    if (/道具|props|气球|balloon|花束|bouquet|烛台|candle|牌子|sign|横幅|banner|烟花|sparkler|泡泡|bubble/i.test(text)) {
        const props = text.match(/道具.*?(?:。|\.|$)|props.*?(?:\.|$)|气球|balloon|花束|bouquet|烟花|sparkler/gi);
        entities.push({ type: 'props', value: props?.[0]?.slice(0, 60) || 'props mentioned', confidence: 0.75 });
    }
    // ── 拍摄风格 (Style) ──
    const styleMap = [
        [/复古|vintage|retro|胶片|film.*style/i, 'vintage/film'],
        [/小清新|清新|自然|natural.*light|户外|outdoor|森系/i, 'natural/outdoor'],
        [/大片|时尚|fashion|杂志|magazine|editorial/i, 'fashion/editorial'],
        [/纪实|documentary|抓拍|candid|journalistic/i, 'documentary/candid'],
        [/韩式|korean.*style|日系|japanese.*style/i, 'korean/japanese style'],
        [/黑白|black.*white|暗黑|dark.*moody/i, 'black&white/moody'],
        [/明亮|bright.*airy|light.*airy|高调/i, 'bright & airy'],
    ];
    for (const [p, label] of styleMap) {
        if (p.test(text)) {
            entities.push({ type: 'style', value: label, confidence: 0.8 });
            break;
        }
    }
    // ── 场地 (Venue) ──
    const venuePatterns = [
        /venue.*?(?:is|at|name|called)\s+["']?([^"',.]+)["']?/i,
        /在\s*(.{2,10}?(?:酒店|庄园|草坪|海滩|教堂|工作室|studio))\s*(?:举办|拍摄|举行)/,
        /(?:at|@)\s+(.{2,20}?(?:hotel|resort|farm|beach|garden|studio|park))/i,
    ];
    for (const p of venuePatterns) {
        const m = text.match(p);
        if (m) {
            entities.push({ type: 'venue', value: m[1].trim(), confidence: 0.85 });
            break;
        }
    }
    // ── 档期流程 (Timeline) ──
    const timelineItems = [];
    if (/first.*look|first.*see|仪式前|婚礼前.*见面/i.test(text))
        timelineItems.push('first look');
    if (/ceremony|仪式|交换.*戒指|vows/i.test(text))
        timelineItems.push('ceremony');
    if (/reception|宴会|晚宴|酒席|dinner|cocktail/i.test(text))
        timelineItems.push('reception');
    if (/getting.*ready|化妆.*准备|prep/i.test(text))
        timelineItems.push('getting ready');
    if (/portrait.*session|formal.*photo|合影|合照/i.test(text))
        timelineItems.push('formal portraits');
    if (/send.*off|退场|exit|sparkler.*exit/i.test(text))
        timelineItems.push('send-off');
    if (/cake.*cutting|切蛋糕|first.*dance|第一支舞/i.test(text))
        timelineItems.push('cake/dance');
    if (timelineItems.length > 0) {
        entities.push({ type: 'timeline', value: timelineItems.join(', '), confidence: 0.7 });
    }
    // ── 人数 ──
    const guestPatterns = [/(\d+)\s*(?:guests?|people|persons|位|人|个)/i, /guests?.*?(\d+)/i];
    for (const p of guestPatterns) {
        const m = text.match(p);
        if (m) {
            entities.push({ type: 'guest_count', value: m[1], confidence: 0.8 });
            break;
        }
    }
    return entities;
}
