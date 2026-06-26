import { logger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';
// ── Structured application error ──
export class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(statusCode, message, code = 'INTERNAL_ERROR', details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = 'AppError';
    }
    static badRequest(msg, code = 'BAD_REQUEST') { return new AppError(400, msg, code); }
    static unauthorized(msg = 'Unauthorized') { return new AppError(401, msg, 'UNAUTHORIZED'); }
    static forbidden(msg = 'Forbidden') { return new AppError(403, msg, 'FORBIDDEN'); }
    static notFound(msg = 'Not found') { return new AppError(404, msg, 'NOT_FOUND'); }
    static conflict(msg, code = 'CONFLICT') { return new AppError(409, msg, code); }
    static paymentRequired(msg, code = 'PAYMENT_REQUIRED') { return new AppError(402, msg, code); }
}
// Wraps async route handlers to catch errors and pass to Express error middleware
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof AppError) {
        logger.warn(`[AppError] ${err.code} (${err.statusCode}): ${err.message}`);
        return res.status(err.statusCode).json({
            ok: false,
            error: err.message,
            code: err.code,
            ...(err.details ? { details: err.details } : {}),
        });
    }
    logger.error(`[UnhandledError] ${err.message}`, err.stack?.split('\n').slice(0, 3).join(' | '));
    captureException(err);
    res.status(500).json({
        ok: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
}
export function notFound(_req, res) {
    res.status(404).json({ ok: false, error: 'Not found', code: 'NOT_FOUND' });
}
