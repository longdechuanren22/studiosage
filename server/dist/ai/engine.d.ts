export declare function getAIStatus(): {
    active: boolean;
    model: "claude" | "deepseek" | "offline";
    providers: {
        claude: boolean;
        deepseek: boolean;
    };
    consecutiveFailures: number;
    fallback: boolean;
};
interface ClientContext {
    name?: string;
    stage?: string;
    shootDate?: string;
    packageType?: string;
    galleryUploaded?: number;
    galleryTotal?: number;
    pendingInvoices?: number;
}
interface ClassifyResult {
    category: 'urgent' | 'normal' | 'spam';
    summary: string;
    suggestedReply: string;
    confidence: number;
    stage?: string;
}
export declare function callAI(prompt: string, maxTokens?: number, temp?: number): Promise<string>;
export declare function classifyMessage(body: string, subject: string, ctx?: ClientContext): Promise<ClassifyResult>;
export interface GenerateInvoiceParams {
    photographerName: string;
    photographerEmail: string;
    clientName: string;
    clientEmail: string;
    packageType: string;
    amount: number;
    currency?: string;
    paymentSchedule?: 'single' | 'three-phase';
    additionalNotes?: string;
}
export declare function generateInvoiceData(params: GenerateInvoiceParams): Promise<any>;
declare const REVISION_TYPES: readonly ["exposure", "color", "crop", "blemish", "background", "other"];
type RevisionType = typeof REVISION_TYPES[number];
interface RevisionClassifyResult {
    revisionType: RevisionType;
    confidence: number;
}
/**
 * AI 修改类型识别 — 客户写"亮一点"→自动归类为 exposure
 * Falls back to keyword matching when AI unavailable
 */
export declare function classifyRevisionType(description: string): Promise<RevisionClassifyResult>;
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
export declare function detectRevisionConflict(previousRevisions: RevisionRecord[], newDescription: string, newType: string): Promise<ConflictResult>;
interface PaymentContext {
    clientName: string;
    projectTitle: string;
    amount: number;
    currency?: string;
    daysOverdue: number;
    paymentType: 'retainer' | 'installment' | 'final';
}
/**
 * AI 催款话术生成 — 按逾期天数分三级语气
 * 0天=友情提醒, 7天=正式催收, 30天=最后通牒
 * Falls back to templates when AI unavailable
 */
export declare function draftPaymentReminder(ctx: PaymentContext): Promise<string>;
interface ClarityResult {
    isSpecific: boolean;
    rejectionReason?: string;
    suggestedType?: RevisionType;
}
/**
 * AI 判断修改描述是否足够具体
 * "亮一点" → ✅ specific
 * "不好看，重做" → ❌ rejected with guidance
 * "瘦一点→太瘦了" → ⚠️ subjective, asked to clarify
 */
export declare function validateRevisionClarity(description: string): Promise<ClarityResult>;
export {};
