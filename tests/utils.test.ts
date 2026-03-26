import './helpers'; // ensure mocks are registered
import { buildPaginationMeta } from '../src/shared/utils/response';
import { AppError, NotFoundError, ConflictError, ValidationError, UnauthorizedError, ForbiddenError, TwilioError } from '../src/shared/utils/errors';

describe('buildPaginationMeta', () => {
  it('calculates multi-page result correctly', () => {
    const meta = buildPaginationMeta(100, 2, 10);
    expect(meta).toMatchObject({ total: 100, page: 2, limit: 10, totalPages: 10, hasNext: true, hasPrev: true });
  });

  it('flags first page (no prev)', () => {
    const meta = buildPaginationMeta(50, 1, 10);
    expect(meta.hasPrev).toBe(false);
    expect(meta.hasNext).toBe(true);
  });

  it('flags last page (no next)', () => {
    const meta = buildPaginationMeta(20, 2, 10);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(true);
  });

  it('handles single page', () => {
    const meta = buildPaginationMeta(5, 1, 10);
    expect(meta.totalPages).toBe(1);
    expect(meta.hasNext).toBe(false);
    expect(meta.hasPrev).toBe(false);
  });

  it('handles empty result', () => {
    const meta = buildPaginationMeta(0, 1, 10);
    expect(meta.totalPages).toBe(0);
    expect(meta.hasNext).toBe(false);
  });
});

describe('Custom Error Classes', () => {
  it('NotFoundError → 404', () => {
    const err = new NotFoundError('Client');
    expect(err.statusCode).toBe(404);
    expect(err.message).toContain('Client');
    expect(err instanceof AppError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });

  it('ConflictError → 409', () => {
    const err = new ConflictError('Already exists');
    expect(err.statusCode).toBe(409);
  });

  it('ValidationError → 400', () => {
    const err = new ValidationError('Bad input');
    expect(err.statusCode).toBe(400);
  });

  it('UnauthorizedError → 401', () => {
    const err = new UnauthorizedError();
    expect(err.statusCode).toBe(401);
  });

  it('ForbiddenError → 403', () => {
    const err = new ForbiddenError();
    expect(err.statusCode).toBe(403);
  });

  it('TwilioError → 502', () => {
    const err = new TwilioError('service unavailable');
    expect(err.statusCode).toBe(502);
    expect(err.message).toContain('Twilio');
  });

  it('AppError.isOperational defaults to true', () => {
    const err = new AppError('Test', 500);
    expect(err.isOperational).toBe(true);
  });

  it('AppError.isOperational can be set false', () => {
    const err = new AppError('Test', 500, false);
    expect(err.isOperational).toBe(false);
  });
});
