export interface ClassifyResult {
    category: 'urgent' | 'normal' | 'spam';
    summary: string;
    suggestedReply: string;
    confidence: number;
    stage: string;
    sentiment?: 'positive' | 'neutral' | 'anxious' | 'frustrated' | 'urgent';
    pricingIntent?: boolean;
    needsImmediateAttention?: boolean;
}
export interface InvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
}
export interface GenerateInvoiceParams {
    photographerName: string;
    photographerEmail: string;
    clientName: string;
    clientEmail: string;
    packageType: string;
    amount: number;
    currency?: string;
    paymentSchedule?: 'single' | 'three-phase';
}
export declare function classifyOffline(body: string, subject: string, clientContext?: {
    name?: string;
    stage?: string;
    packageType?: string;
}): ClassifyResult;
export declare function detectShootType(text: string): string | null;
export interface ExtractedEntity {
    type: 'date' | 'budget' | 'location' | 'guest_count' | 'hours' | 'requirement' | 'change' | 'question' | 'urgency';
    value: string;
    raw: string;
    confidence: number;
}
export declare function extractEntities(body: string, subject: string): ExtractedEntity[];
export declare function generateInvoiceOffline(params: GenerateInvoiceParams): {
    items: InvoiceItem[];
    subtotal: number;
    retainerLabel: "non-refundable-retainer";
    paymentSchedule: {
        label: string;
        amount: number;
        dueDate: string;
    }[];
    notes: string;
    taxNote: string;
};
