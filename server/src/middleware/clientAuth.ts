import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const envSecret = process.env.CLIENT_JWT_SECRET || process.env.JWT_SECRET;
if (!envSecret) {
  throw new Error('JWT_SECRET 或 CLIENT_JWT_SECRET 环境变量未设置！');
}
const CLIENT_JWT_SECRET: string = envSecret;

export interface ClientTokenPayload {
  clientId: string;
  clientEmail: string;
  userId: string;
}

/** Sign a token for client portal access (valid 30 days) */
export function signClientToken(payload: ClientTokenPayload): string {
  return jwt.sign(payload, CLIENT_JWT_SECRET, { expiresIn: '30d' });
}

/** Verify client token */
export function verifyClientToken(token: string): ClientTokenPayload {
  return jwt.verify(token, CLIENT_JWT_SECRET) as ClientTokenPayload;
}

/** Middleware: authenticate client via ?token= query param or Authorization header */
export function authenticateClient(req: Request, res: Response, next: NextFunction): void {
  const token = (req.query.token as string) || req.headers['x-client-token'] as string;
  if (!token) {
    res.status(401).json({ ok: false, error: 'Missing client token', code: 'UNAUTHORIZED' });
    return;
  }
  try {
    const payload = verifyClientToken(token);
    (req as any).clientId = payload.clientId;
    (req as any).clientEmail = payload.clientEmail;
    (req as any).clientUserId = payload.userId;
    next();
  } catch {
    res.status(401).json({ ok: false, error: '链接已过期，请联系摄影师获取新链接', code: 'TOKEN_EXPIRED' });
  }
}
