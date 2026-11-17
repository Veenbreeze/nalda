import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ApiError } from '../utils/errors';
import { isProduction } from '../config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      code = 'CONFLICT';
      const target = (err.meta?.target as string[] | undefined)?.join(', ');
      message = target ? `A record with this ${target} already exists` : 'A duplicate record already exists';
      details = err.meta;
    } else if (err.code === 'P2025') {
      statusCode = 404;
      code = 'NOT_FOUND';
      message = 'The requested record was not found';
    } else {
      statusCode = 400;
      code = 'DATABASE_ERROR';
      message = 'A database error occurred';
      details = isProduction ? undefined : err.meta;
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    code = 'DATABASE_VALIDATION_ERROR';
    message = 'Invalid data provided';
  } else if (err instanceof Error) {
    message = isProduction ? 'Internal server error' : err.message;
  }

  if (statusCode >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      ...(isProduction ? {} : { stack: err instanceof Error ? err.stack : undefined }),
    },
  });
}
