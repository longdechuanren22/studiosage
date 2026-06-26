import { Request, Response, NextFunction, RequestHandler } from 'express';
export declare class AppError extends Error {
    statusCode: number;
    code: string;
    details?: unknown;
    constructor(statusCode: number, message: string, code?: string, details?: unknown);
    static badRequest(msg: string, code?: string): AppError;
    static unauthorized(msg?: string): AppError;
    static forbidden(msg?: string): AppError;
    static notFound(msg?: string): AppError;
    static conflict(msg: string, code?: string): AppError;
    static paymentRequired(msg: string, code?: string): AppError;
}
export declare function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler;
export declare function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function notFound(_req: Request, res: Response): void;
