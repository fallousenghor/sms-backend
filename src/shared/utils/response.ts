import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
  errors?: ValidationError[];
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export class ResponseHelper {
  static success<T>(res: Response, data: T, message = 'Success', statusCode = 200): Response {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    } as ApiResponse<T>);
  }

  static created<T>(res: Response, data: T, message = 'Created successfully'): Response {
    return res.status(201).json({
      success: true,
      message,
      data,
    } as ApiResponse<T>);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    meta: PaginationMeta,
    message = 'Success'
  ): Response {
    return res.status(200).json({
      success: true,
      message,
      data,
      meta,
    } as ApiResponse<T[]>);
  }

  static error(
    res: Response,
    message: string,
    statusCode = 500,
    errors?: ValidationError[]
  ): Response {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
    } as ApiResponse);
  }

  static notFound(res: Response, message = 'Resource not found'): Response {
    return res.status(404).json({
      success: false,
      message,
    } as ApiResponse);
  }

  static unauthorized(res: Response, message = 'Unauthorized'): Response {
    return res.status(401).json({
      success: false,
      message,
    } as ApiResponse);
  }

  static forbidden(res: Response, message = 'Forbidden'): Response {
    return res.status(403).json({
      success: false,
      message,
    } as ApiResponse);
  }

  static badRequest(res: Response, message: string, errors?: ValidationError[]): Response {
    return res.status(400).json({
      success: false,
      message,
      errors,
    } as ApiResponse);
  }
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
