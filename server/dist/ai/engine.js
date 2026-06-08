// AI Engine — API-first with offline fallback
import { classifyOffline, generateInvoiceOffline } from './rules-engine.js';
const AI_KEY = process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY || '';
const AI_URL = process.env.DEEPSEEK_API_KEY
    ? 'https://api.deepseek.com/v1/chat/completions'
    : 'https://api.anthropic.com/v1/messages';
const USE_AI = !!AI_KEY;
async function callAI(prompt, maxTokens = 600, temp = 0.3) {
    if (process.env.DEEPSEEK_API_KEY) {
        const res = await fetch(AI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AI_KEY}` },
            body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature: temp }),
        });
        if (!res.ok)
            throw new Error(`DeepSeek ${res.status}`);
        const data = await res.json();
        return data.choices[0].message.content;
    }
    const res = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'x-api-key': AI_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, temperature: temp, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok)
        throw new Error(`Claude ${res.status}`);
    const data = await res.json();
    return data.content[0].text;
}
export async function classifyMessage(body, subject, ctx) {
    if (!USE_AI)
        return classifyOffline(body, subject, ctx);
    const stageInfo = ctx
        ? `Client: ${ctx.name || 'Unknown'}, Stage: ${ctx.stage || '?'}, Gallery: ${ctx.galleryUploaded || 0}/${ctx.galleryTotal || 0}`
        : 'No context';
    const prompt = `Classify this photography client message. Context: ${stageInfo}\nSubject: "${subject}"\nMessage: "${body}"\nOutput JSON: {"category":"urgent|normal|spam","summary":"...","suggestedReply":"...","confidence":0.X,"stage":"inquiry|...|post_delivery"}`;
    const text = await callAI(prompt, 600, 0.3);
    return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, ''));
}
export async function generateInvoiceData(params) {
    if (!USE_AI)
        return generateInvoiceOffline(params);
    const prompt = `Generate photography invoice JSON. Input: ${JSON.stringify(params)}. Include line items, retainer label, 3-phase schedule if applicable.`;
    const text = await callAI(prompt, 500, 0.2);
    return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, ''));
}
