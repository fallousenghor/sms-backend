// jest.mock calls are hoisted by Babel/ts-jest — must be at top level
jest.mock('../src/shared/config/prisma', () => ({
  prisma: {
    user:        { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    client:      { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), upsert: jest.fn(), delete: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    group:       { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    clientGroup: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    smsCampaign: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    smsLog:      { findUnique: jest.fn(), create: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    $connect: jest.fn(), $disconnect: jest.fn(),
  },
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
}));

jest.mock('twilio', () => jest.fn(() => ({ messages: { create: jest.fn() } })));

import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma: db } = require('../src/shared/config/prisma');

const app = createApp();

function makeToken(userId = 'user-uuid-1', email = 'test@test.com', role = 'USER') {
  return jwt.sign({ userId, email, role }, process.env.JWT_SECRET!, { expiresIn: '1h' } as jwt.SignOptions);
}

const userFactory = (o: Record<string, unknown> = {}) => ({
  id: 'user-uuid-1', name: 'Test', email: 'test@example.com',
  password: '$2b$12$x', role: 'USER',
  createdAt: new Date(), updatedAt: new Date(), ...o,
});

const clientFactory = (o: Record<string, unknown> = {}) => ({
  id: 'c-uuid-1', firstName: 'Jean', lastName: 'Dupont',
  phone: '+221771234567', email: null, tags: [], isActive: true,
  createdAt: new Date(), updatedAt: new Date(), groups: [], smsLogs: [], ...o,
});

const groupFactory = (o: Record<string, unknown> = {}) => ({
  id: 'g-uuid-1', name: 'VIP', description: null, color: '#3B82F6',
  createdAt: new Date(), updatedAt: new Date(), _count: { clients: 2 }, ...o,
});

const campaignFactory = (o: Record<string, unknown> = {}) => ({
  id: 'cam-uuid-1', name: 'Test', message: 'Hello', status: 'PENDING',
  totalCount: 1, sentCount: 0, failedCount: 0,
  scheduledAt: null, startedAt: null, completedAt: null,
  userId: 'user-uuid-1', groupId: null,
  createdAt: new Date(), updatedAt: new Date(), ...o,
});

beforeEach(() => jest.clearAllMocks());

// ── Health ───────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Unknown route', () => {
  it('returns 404', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ── Auth ─────────────────────────────────────────────────────────────────────
describe('POST /api/v1/auth/register', () => {
  it('201 on valid payload', async () => {
    (db.user.findUnique as jest.Mock).mockResolvedValue(null);
    (db.user.create as jest.Mock).mockResolvedValue(userFactory());

    const res = await request(app).post('/api/v1/auth/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeDefined();
  });

  it('400 on missing fields', async () => {
    const res = await request(app).post('/api/v1/auth/register')
      .send({ email: 'x@x.com' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  it('409 if email taken', async () => {
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory());
    const res = await request(app).post('/api/v1/auth/register')
      .send({ name: 'X', email: 'x@x.com', password: 'password123' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('200 with valid creds', async () => {
    const hashed = await bcrypt.hash('password123', 10);
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory({ password: hashed }));

    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });

  it('401 on wrong password', async () => {
    (db.user.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await request(app).post('/api/v1/auth/login')
      .send({ email: 'nobody@x.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});

// ── Clients ──────────────────────────────────────────────────────────────────
describe('GET /api/v1/clients', () => {
  it('401 without token', async () => {
    const res = await request(app).get('/api/v1/clients');
    expect(res.status).toBe(401);
  });

  it('200 with valid token', async () => {
    const token = makeToken();
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory());
    (db.client.findMany as jest.Mock).mockResolvedValue([clientFactory()]);
    (db.client.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app).get('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.total).toBe(1);
  });
});

describe('POST /api/v1/clients', () => {
  it('201 on valid client', async () => {
    const token = makeToken();
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory());
    (db.client.findUnique as jest.Mock).mockResolvedValue(null);
    (db.client.create as jest.Mock).mockResolvedValue(clientFactory());

    const res = await request(app).post('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Jean', lastName: 'Dupont', phone: '+221771234567' });

    expect(res.status).toBe(201);
  });

  it('400 on invalid phone', async () => {
    const token = makeToken();
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory());

    const res = await request(app).post('/api/v1/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'Jean', lastName: 'Dupont', phone: 'not-a-phone' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/clients/stats', () => {
  it('200 with stats', async () => {
    const token = makeToken();
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory());
    (db.client.count as jest.Mock)
      .mockResolvedValueOnce(10).mockResolvedValueOnce(8).mockResolvedValueOnce(2);
    (db.group.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app).get('/api/v1/clients/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(10);
  });
});

// ── Groups ────────────────────────────────────────────────────────────────────
describe('GET /api/v1/groups', () => {
  it('200 with group list', async () => {
    const token = makeToken();
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory());
    (db.group.findMany as jest.Mock).mockResolvedValue([groupFactory()]);
    (db.group.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app).get('/api/v1/groups')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('POST /api/v1/groups', () => {
  it('201 on valid group', async () => {
    const token = makeToken();
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory());
    (db.group.findUnique as jest.Mock).mockResolvedValue(null);
    (db.group.create as jest.Mock).mockResolvedValue(groupFactory());

    const res = await request(app).post('/api/v1/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'VIP', color: '#10B981' });

    expect(res.status).toBe(201);
  });

  it('400 on invalid color', async () => {
    const token = makeToken();
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory());

    const res = await request(app).post('/api/v1/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test', color: 'bad-color' });

    expect(res.status).toBe(400);
  });
});

// ── SMS ───────────────────────────────────────────────────────────────────────
describe('POST /api/v1/sms/campaigns', () => {
  it('400 when message missing', async () => {
    const token = makeToken();
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory());

    const res = await request(app).post('/api/v1/sms/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ sendToAll: true });

    expect(res.status).toBe(400);
  });

  it('400 when no active clients', async () => {
    const token = makeToken();
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory());
    (db.client.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app).post('/api/v1/sms/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello!', sendToAll: true });

    expect(res.status).toBe(400);
  });

  it('201 when clients found', async () => {
    const token = makeToken();
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory());
    (db.client.findMany as jest.Mock).mockResolvedValue([{ id: 'c1', phone: '+221771111111' }]);
    (db.smsCampaign.create as jest.Mock).mockResolvedValue(campaignFactory());
    (db.smsCampaign.update as jest.Mock).mockResolvedValue(campaignFactory({ status: 'RUNNING' }));
    (db.smsLog.create as jest.Mock).mockResolvedValue({});

    const res = await request(app).post('/api/v1/sms/campaigns')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello!', sendToAll: true, campaignName: 'Test Campaign' });

    expect(res.status).toBe(201);
    expect(res.body.data.campaign).toBeDefined();
    expect(res.body.data.dispatched).toBe(true);
  });
});

describe('GET /api/v1/sms/campaigns', () => {
  it('200 with campaign list', async () => {
    const token = makeToken();
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory());
    (db.smsCampaign.findMany as jest.Mock).mockResolvedValue([campaignFactory()]);
    (db.smsCampaign.count as jest.Mock).mockResolvedValue(1);

    const res = await request(app).get('/api/v1/sms/campaigns')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('GET /api/v1/sms/stats', () => {
  it('200 with stats', async () => {
    const token = makeToken();
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory());
    (db.smsCampaign.count as jest.Mock).mockResolvedValue(5);
    (db.smsCampaign.groupBy as jest.Mock).mockResolvedValue([]);
    (db.smsCampaign.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app).get('/api/v1/sms/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(5);
  });
});

describe('POST /api/v1/sms/send', () => {
  it('200 on single SMS send', async () => {
    const token = makeToken();
    (db.user.findUnique as jest.Mock).mockResolvedValue(userFactory());
    // Twilio mock is already set at module level
    const twilioMock = require('twilio')().messages.create as jest.Mock;
    twilioMock.mockResolvedValue({ sid: 'SM123', status: 'queued' });

    const res = await request(app).post('/api/v1/sms/send')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '+221771234567', message: 'Test SMS' });

    expect(res.status).toBe(200);
  });
});
