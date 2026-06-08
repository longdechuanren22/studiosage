export function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
            return;
        }
        req.body = result.data;
        next();
    };
}
// Shared schemas
import { z } from 'zod';
export const incomingMessageSchema = z.object({
    from: z.string().optional(),
    subject: z.string().optional(),
    body: z.string().min(1, 'Message body is required'),
    clientId: z.string().optional(),
});
export const generateInvoiceSchema = z.object({
    clientName: z.string().min(1),
    clientEmail: z.string().email(),
    packageType: z.enum(['wedding', 'portrait', 'event', 'commercial']),
    amount: z.number().positive(),
    currency: z.string().default('USD'),
    paymentSchedule: z.enum(['single', 'three-phase']).default('single'),
    photographerName: z.string().optional(),
    photographerEmail: z.string().optional(),
    notes: z.string().optional(),
});
