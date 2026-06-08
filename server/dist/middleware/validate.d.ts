import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
export declare function validate(schema: ZodSchema): (req: Request, res: Response, next: NextFunction) => void;
import { z } from 'zod';
export declare const incomingMessageSchema: z.ZodObject<{
    from: z.ZodOptional<z.ZodString>;
    subject: z.ZodOptional<z.ZodString>;
    body: z.ZodString;
    clientId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    body: string;
    from?: string | undefined;
    subject?: string | undefined;
    clientId?: string | undefined;
}, {
    body: string;
    from?: string | undefined;
    subject?: string | undefined;
    clientId?: string | undefined;
}>;
export declare const generateInvoiceSchema: z.ZodObject<{
    clientName: z.ZodString;
    clientEmail: z.ZodString;
    packageType: z.ZodEnum<["wedding", "portrait", "event", "commercial"]>;
    amount: z.ZodNumber;
    currency: z.ZodDefault<z.ZodString>;
    paymentSchedule: z.ZodDefault<z.ZodEnum<["single", "three-phase"]>>;
    photographerName: z.ZodOptional<z.ZodString>;
    photographerEmail: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    clientName: string;
    clientEmail: string;
    packageType: "wedding" | "portrait" | "event" | "commercial";
    amount: number;
    currency: string;
    paymentSchedule: "single" | "three-phase";
    notes?: string | undefined;
    photographerName?: string | undefined;
    photographerEmail?: string | undefined;
}, {
    clientName: string;
    clientEmail: string;
    packageType: "wedding" | "portrait" | "event" | "commercial";
    amount: number;
    currency?: string | undefined;
    paymentSchedule?: "single" | "three-phase" | undefined;
    notes?: string | undefined;
    photographerName?: string | undefined;
    photographerEmail?: string | undefined;
}>;
