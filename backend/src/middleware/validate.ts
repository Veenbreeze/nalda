import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError, ZodTypeAny } from 'zod';
import { ApiError } from '../utils/errors';

type RequestPart = 'body' | 'query' | 'params';

export function validate(schema: AnyZodObject | ZodTypeAny, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const result = schema.parse(req[part]);
      if (part === 'body') req.body = result;
      if (part === 'query') req.query = result as Request['query'];
      if (part === 'params') req.params = result as Request['params'];
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        next(ApiError.validation('Validation failed', details));
      } else {
        next(err);
      }
    }
  };
}
