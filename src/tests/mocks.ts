/**
 * Central mock registrations for unit tests inside src/modules/.
 * Import this at the TOP of any *.service.test.ts before other imports.
 * jest.mock() paths are resolved from the ROOT of the project (where jest.config.ts lives).
 */

jest.mock('src/shared/config/prisma', () => ({
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

export {};
