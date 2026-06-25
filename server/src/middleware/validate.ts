import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
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

export const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  wechat_id: z.string().optional(),
  type: z.string().optional(),
  notes: z.string().optional(),
});

export const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  wechat_id: z.string().optional(),
  type: z.string().optional(),
  stage: z.string().optional(),
  package_type: z.string().optional(),
  shoot_date: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
});

export const createProjectSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  title: z.string().min(1, 'Project title is required'),
  shootType: z.string().optional(),
  shootDate: z.string().optional(),
  deliveryDueDate: z.string().optional(),
  packageType: z.string().optional(),
  proposalId: z.string().optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  shootType: z.string().optional(),
  shootDate: z.string().optional(),
  deliveryDueDate: z.string().optional(),
  packageType: z.string().optional(),
  maxRetouchCount: z.number().int().positive().optional(),
  maxRevisionRounds: z.number().int().positive().optional(),
});

export const updateSettingsSchema = z.object({
  autoReply: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});
