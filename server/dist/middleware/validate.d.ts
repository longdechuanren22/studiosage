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
    notes?: string | undefined;
    currency?: string | undefined;
    paymentSchedule?: "single" | "three-phase" | undefined;
    photographerName?: string | undefined;
    photographerEmail?: string | undefined;
}>;
export declare const createClientSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    phone: z.ZodOptional<z.ZodString>;
    wechat_id: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    phone?: string | undefined;
    wechat_id?: string | undefined;
    notes?: string | undefined;
    type?: string | undefined;
    email?: string | undefined;
}, {
    name: string;
    phone?: string | undefined;
    wechat_id?: string | undefined;
    notes?: string | undefined;
    type?: string | undefined;
    email?: string | undefined;
}>;
export declare const updateClientSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    email: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    phone: z.ZodOptional<z.ZodString>;
    wechat_id: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    stage: z.ZodOptional<z.ZodString>;
    package_type: z.ZodOptional<z.ZodString>;
    shoot_date: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phone?: string | undefined;
    wechat_id?: string | undefined;
    notes?: string | undefined;
    type?: string | undefined;
    status?: string | undefined;
    name?: string | undefined;
    email?: string | undefined;
    stage?: string | undefined;
    package_type?: string | undefined;
    shoot_date?: string | undefined;
}, {
    phone?: string | undefined;
    wechat_id?: string | undefined;
    notes?: string | undefined;
    type?: string | undefined;
    status?: string | undefined;
    name?: string | undefined;
    email?: string | undefined;
    stage?: string | undefined;
    package_type?: string | undefined;
    shoot_date?: string | undefined;
}>;
export declare const createProjectSchema: z.ZodObject<{
    clientId: z.ZodString;
    title: z.ZodString;
    shootType: z.ZodOptional<z.ZodString>;
    shootDate: z.ZodOptional<z.ZodString>;
    deliveryDueDate: z.ZodOptional<z.ZodString>;
    packageType: z.ZodOptional<z.ZodString>;
    proposalId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    clientId: string;
    title: string;
    packageType?: string | undefined;
    shootType?: string | undefined;
    shootDate?: string | undefined;
    deliveryDueDate?: string | undefined;
    proposalId?: string | undefined;
}, {
    clientId: string;
    title: string;
    packageType?: string | undefined;
    shootType?: string | undefined;
    shootDate?: string | undefined;
    deliveryDueDate?: string | undefined;
    proposalId?: string | undefined;
}>;
export declare const updateProjectSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    shootType: z.ZodOptional<z.ZodString>;
    shootDate: z.ZodOptional<z.ZodString>;
    deliveryDueDate: z.ZodOptional<z.ZodString>;
    packageType: z.ZodOptional<z.ZodString>;
    maxRetouchCount: z.ZodOptional<z.ZodNumber>;
    maxRevisionRounds: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    packageType?: string | undefined;
    title?: string | undefined;
    shootType?: string | undefined;
    shootDate?: string | undefined;
    deliveryDueDate?: string | undefined;
    maxRetouchCount?: number | undefined;
    maxRevisionRounds?: number | undefined;
}, {
    packageType?: string | undefined;
    title?: string | undefined;
    shootType?: string | undefined;
    shootDate?: string | undefined;
    deliveryDueDate?: string | undefined;
    maxRetouchCount?: number | undefined;
    maxRevisionRounds?: number | undefined;
}>;
export declare const updateSettingsSchema: z.ZodObject<{
    autoReply: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    autoReply?: boolean | undefined;
}, {
    autoReply?: boolean | undefined;
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const resetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
    newPassword: string;
}, {
    token: string;
    newPassword: string;
}>;
