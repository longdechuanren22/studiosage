interface CreateInvoiceParams {
    clientName: string;
    clientEmail: string;
    items: {
        description: string;
        amount: number;
        quantity: number;
    }[];
    paymentSchedule: 'single' | 'three-phase';
    retainerLabel?: string;
    invoiceId?: string;
}
interface StripeInvoiceResult {
    id: string;
    paymentLink: string;
    status: string;
    subtotal: number;
    total: number;
}
export declare class StripeAdapter {
    private secretKey;
    private baseUrl;
    constructor(secretKey: string);
    private request;
    createInvoice(params: CreateInvoiceParams): Promise<StripeInvoiceResult>;
    getPaymentStatus(linkId: string): Promise<'paid' | 'pending'>;
}
export {};
