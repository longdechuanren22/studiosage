import { Request, Response, NextFunction, RequestHandler } from 'express';

// Wraps async route handlers to catch errors and pass to Express error middleware
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('[StudioSage Error]', err.message);
  res.status(500).json({
    ok: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ ok: false, error: 'Not found' });
}
