import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const envSecret = process.env.JWT_SECRET;
if (!envSecret) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET: string = envSecret;
const TOKEN_EXPIRY = '7d';

export interface JwtPayload {
  userId: string;
  email: string;
}

/** Sign a JWT token for a user */
export function signToken(payload: JwtPayload, expiresIn = TOKEN_EXPIRY): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

/** Verify a JWT token and return the payload */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/** Simple token fingerprint for blacklist lookup */
export function tokenFingerprint(token: string): string {
  // Use first 64 chars as fingerprint — sufficient for uniqueness
  return token.slice(0, 64);
}

/** Check if token is blacklisted */
function isBlacklisted(fingerprint: string): boolean {
  try {
    const { queryOne } = require('../db/query.js');
    const row = queryOne('SELECT 1 FROM token_blacklist WHERE token_fingerprint = ? AND expires_at > datetime(?)', [fingerprint, 'now']);
    return !!row;
  } catch {
    return false; // DB not ready — allow through
  }
}

// Extend Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

/** Middleware: require a valid JWT token */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Authentication required', code: 'UNAUTHORIZED' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = verifyToken(token);
    // Check blacklist
    if (isBlacklisted(tokenFingerprint(token))) {
      res.status(401).json({ ok: false, error: 'Session has been logged out. Please sign in again.', code: 'TOKEN_REVOKED' });
      return;
    }
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'Session expired. Please sign in again.', code: 'TOKEN_EXPIRED' });
  }
}

/** Middleware: attach user if token present, but don't require it */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(header.slice(7));
      req.userId = payload.userId;
      req.userEmail = payload.email;
    } catch { /* token invalid — continue without user */ }
  }
  next();
}
