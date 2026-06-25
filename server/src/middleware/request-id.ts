import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

// Assign a unique X-Request-Id to every request for log correlation and tracing
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  (req as any).requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
