import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { ResponseHelper } from '../utils/response';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    name: err.name,
  });

  if (err instanceof AppError) {
    ResponseHelper.error(res, err.message, err.statusCode);
    return;
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as unknown as { code: string; meta?: { target?: string[] } };
    if (prismaErr.code === 'P2002') {
      const field = prismaErr.meta?.target?.[0] || 'field';
      ResponseHelper.error(res, `A record with this ${field} already exists`, 409);
      return;
    }
    if (prismaErr.code === 'P2025') {
      ResponseHelper.notFound(res, 'Record not found');
      return;
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    ResponseHelper.unauthorized(res, 'Invalid token');
    return;
  }

  if (err.name === 'TokenExpiredError') {
    ResponseHelper.unauthorized(res, 'Token expired');
    return;
  }

  // Default server error
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  ResponseHelper.error(res, message, 500);
}

export function notFoundHandler(req: Request, res: Response): void {
  ResponseHelper.notFound(res, `Route ${req.method} ${req.url} not found`);
}
