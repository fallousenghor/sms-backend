import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

// ── Prisma mock accessor ─────────────────────────────────────────────────────
// The actual jest.mock() calls live in src/tests/mocks.ts (for src/ tests)
// and in this file's jest.mock() calls (for tests/ root tests).

jest.mock('../src/shared/config/prisma', () => ({
  prisma: {
    user:        { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    client:      { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), upsert: jest.fn(), delete: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    group:       { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    clientGroup: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    smsCampaign: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    smsLog:      { findUnique: jest.fn(), create: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    $connect:    jest.fn(),
    $disconnect: jest.fn(),
  },
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
}));

jest.mock('twilio', () =>
  jest.fn(() => ({ messages: { create: jest.fn() } }))
);

// Re-export the mock so tests can access the fns
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const mockPrisma = require('../src/shared/config/prisma').prisma as PrismaClient;

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const mockTwilioCreate: jest.Mock = require('twilio')().messages.create;

// ── JWT helper ───────────────────────────────────────────────────────────────
export function generateTestToken(
  userId = 'test-user-id',
  email = 'test@test.com',
  role = 'USER'
): string {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' } as jwt.SignOptions
  );
}

// ── Data factories ───────────────────────────────────────────────────────────
export const factories = {
  user: (overrides: Record<string, unknown> = {}) => ({
    id: 'user-uuid-1',
    name: 'Test User',
    email: 'test@example.com',
    password: '$2b$12$hashedpassword',
    role: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  client: (overrides: Record<string, unknown> = {}) => ({
    id: 'client-uuid-1',
    firstName: 'Jean',
    lastName: 'Dupont',
    phone: '+221771234567',
    email: 'jean@example.com',
    tags: ['vip'],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    groups: [],
    smsLogs: [],
    ...overrides,
  }),

  group: (overrides: Record<string, unknown> = {}) => ({
    id: 'group-uuid-1',
    name: 'VIP Clients',
    description: 'High value clients',
    color: '#3B82F6',
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { clients: 5 },
    ...overrides,
  }),

  campaign: (overrides: Record<string, unknown> = {}) => ({
    id: 'campaign-uuid-1',
    name: 'Test Campaign',
    message: 'Hello World!',
    status: 'PENDING',
    totalCount: 10,
    sentCount: 0,
    failedCount: 0,
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    userId: 'user-uuid-1',
    groupId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};
