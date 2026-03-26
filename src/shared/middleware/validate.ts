import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ResponseHelper } from '../utils/response';

export function validateRequest(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.type === 'field' ? err.path : 'unknown',
      message: err.msg,
    }));

    ResponseHelper.badRequest(res, 'Validation failed', formattedErrors);
    return;
  }

  next();
}
