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
export {};
