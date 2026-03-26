jest.mock('src/shared/config/prisma', () => ({
  prisma: {
    client:      { findMany: jest.fn() },
    smsCampaign: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    smsLog:      { create: jest.fn(), findMany: jest.fn() },
    $connect: jest.fn(), $disconnect: jest.fn(),
  },
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
}));

jest.mock('twilio', () => jest.fn(() => ({ messages: { create: jest.fn() } })));

import { SmsService } from './sms.service';
import { TwilioService } from './twilio.service';
import { ValidationError, NotFoundError } from '../../shared/utils/errors';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { prisma: db } = require('src/shared/config/prisma');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mockTwilioCreate: jest.Mock = require('twilio')().messages.create;

const campaignFactory = (o: Record<string, unknown> = {}) => ({
  id: 'cam-uuid-1', name: 'Test', message: 'Hello', status: 'PENDING',
  totalCount: 1, sentCount: 0, failedCount: 0,
  scheduledAt: null, startedAt: null, completedAt: null,
  userId: 'user-uuid-1', groupId: null,
  createdAt: new Date(), updatedAt: new Date(), ...o,
});

const clientFactory = (o: Record<string, unknown> = {}) => ({
  id: 'c-uuid-1', firstName: 'Jean', lastName: 'Dupont',
  phone: '+221771234567', tags: [], isActive: true,
  createdAt: new Date(), updatedAt: new Date(), groups: [], smsLogs: [], ...o,
});

describe('SmsService', () => {
  let smsService: SmsService;
  let twilioService: TwilioService;

  beforeEach(() => {
    twilioService = new TwilioService();
    smsService = new SmsService(twilioService);
    jest.clearAllMocks();
  });

  // ── sendSingle ─────────────────────────────────────────────────────────────
  describe('sendSingle', () => {
    it('should send SMS and return result', async () => {
      jest.spyOn(twilioService, 'sendSms').mockResolvedValue({ sid: 'SM123', status: 'queued' });
      const result = await smsService.sendSingle({ phone: '+221771234567', message: 'Test' });
      expect(result.phone).toBe('+221771234567');
      expect(result.sid).toBe('SM123');
      expect(twilioService.sendSms).toHaveBeenCalledTimes(1);
    });

    it('should return failed status on Twilio error', async () => {
      mockTwilioCreate.mockRejectedValue({ code: '21211', message: 'Invalid phone' });
      const result = await smsService.sendSingle({ phone: '+bad', message: 'Test' });
      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBeDefined();
    });
  });

  // ── createCampaign ─────────────────────────────────────────────────────────
  describe('createCampaign', () => {
    const userId = 'user-uuid-1';

    it('throws ValidationError if no target', async () => {
      await expect(smsService.createCampaign(userId, { message: 'Hi' })).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError if no active clients', async () => {
      (db.client.findMany as jest.Mock).mockResolvedValue([]);
      await expect(smsService.createCampaign(userId, { message: 'Hi', sendToAll: true })).rejects.toThrow(ValidationError);
    });

    it('creates and dispatches campaign with sendToAll', async () => {
      const clients = [{ id: 'c1', phone: '+221771111111' }, { id: 'c2', phone: '+221772222222' }];
      (db.client.findMany as jest.Mock).mockResolvedValue(clients);
      (db.smsCampaign.create as jest.Mock).mockResolvedValue(campaignFactory());
      (db.smsCampaign.update as jest.Mock).mockResolvedValue(campaignFactory({ status: 'RUNNING' }));
      (db.smsLog.create as jest.Mock).mockResolvedValue({});
      mockTwilioCreate.mockResolvedValue({ sid: 'SM999', status: 'queued' });

      const result = await smsService.createCampaign(userId, { message: 'Hello!', sendToAll: true });
      expect(result.campaign).toBeDefined();
      expect(result.dispatched).toBe(true);
    });

    it('schedules without dispatching when scheduledAt given', async () => {
      (db.client.findMany as jest.Mock).mockResolvedValue([{ id: 'c1', phone: '+221771111111' }]);
      (db.smsCampaign.create as jest.Mock).mockResolvedValue(campaignFactory({ scheduledAt: new Date('2030-01-01') }));

      const result = await smsService.createCampaign(userId, {
        message: 'Scheduled', sendToAll: true, scheduledAt: '2030-01-01T10:00:00Z',
      });
      expect(result.dispatched).toBe(false);
      expect(mockTwilioCreate).not.toHaveBeenCalled();
    });

    it('targets specific groupId', async () => {
      (db.client.findMany as jest.Mock).mockResolvedValue([{ id: 'c1', phone: '+221771111111' }]);
      (db.smsCampaign.create as jest.Mock).mockResolvedValue(campaignFactory({ groupId: 'g1' }));
      (db.smsCampaign.update as jest.Mock).mockResolvedValue({});
      (db.smsLog.create as jest.Mock).mockResolvedValue({});
      mockTwilioCreate.mockResolvedValue({ sid: 'SM111', status: 'queued' });

      const result = await smsService.createCampaign(userId, { message: 'Group msg', groupId: 'g1' });
      expect(result.campaign.groupId).toBe('g1');
      const findCall = (db.client.findMany as jest.Mock).mock.calls[0][0];
      expect(findCall.where.groups).toBeDefined();
    });

    it('targets specific clientIds', async () => {
      (db.client.findMany as jest.Mock).mockResolvedValue([{ id: 'c1', phone: '+221771111111' }]);
      (db.smsCampaign.create as jest.Mock).mockResolvedValue(campaignFactory());
      (db.smsCampaign.update as jest.Mock).mockResolvedValue({});
      (db.smsLog.create as jest.Mock).mockResolvedValue({});
      mockTwilioCreate.mockResolvedValue({ sid: 'SM222', status: 'queued' });

      await smsService.createCampaign(userId, { message: 'Targeted', clientIds: ['c1', 'c2'] });
      const findCall = (db.client.findMany as jest.Mock).mock.calls[0][0];
      expect(findCall.where.id.in).toEqual(['c1', 'c2']);
    });
  });

  // ── cancelCampaign ─────────────────────────────────────────────────────────
  describe('cancelCampaign', () => {
    it('cancels a PENDING campaign', async () => {
      (db.smsCampaign.findFirst as jest.Mock).mockResolvedValue(campaignFactory({ status: 'PENDING' }));
      (db.smsCampaign.update as jest.Mock).mockResolvedValue(campaignFactory({ status: 'CANCELLED' }));

      const result = await smsService.cancelCampaign('cam-uuid-1', 'user-uuid-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('throws ValidationError if RUNNING', async () => {
      (db.smsCampaign.findFirst as jest.Mock).mockResolvedValue(campaignFactory({ status: 'RUNNING' }));
      await expect(smsService.cancelCampaign('cam-uuid-1', 'user-uuid-1')).rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError for unknown campaign', async () => {
      (db.smsCampaign.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(smsService.cancelCampaign('nope', 'user-uuid-1')).rejects.toThrow(NotFoundError);
    });
  });

  // ── getCampaigns ───────────────────────────────────────────────────────────
  describe('getCampaigns', () => {
    it('returns paginated campaigns', async () => {
      (db.smsCampaign.findMany as jest.Mock).mockResolvedValue([campaignFactory()]);
      (db.smsCampaign.count as jest.Mock).mockResolvedValue(1);

      const result = await smsService.getCampaigns('user-uuid-1', { page: 1, limit: 10 });
      expect(result.campaigns).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  // ── getDeliveryReport ──────────────────────────────────────────────────────
  describe('getDeliveryReport', () => {
    it('returns report with logs grouped by status', async () => {
      (db.smsCampaign.findFirst as jest.Mock).mockResolvedValue(campaignFactory({ status: 'COMPLETED', sentCount: 9, failedCount: 1 }));
      (db.smsLog.findMany as jest.Mock).mockResolvedValue([
        { id: 'l1', status: 'SENT',   client: clientFactory() },
        { id: 'l2', status: 'FAILED', client: clientFactory({ id: 'c2' }) },
      ]);

      const report = await smsService.getDeliveryReport('cam-uuid-1', 'user-uuid-1');
      expect(report.campaign.sentCount).toBe(9);
      expect(report.logs).toHaveLength(2);
      expect(report.byStatus['SENT']).toBe(1);
      expect(report.byStatus['FAILED']).toBe(1);
    });

    it('throws NotFoundError for unknown campaign', async () => {
      (db.smsCampaign.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(smsService.getDeliveryReport('nope', 'user-uuid-1')).rejects.toThrow(NotFoundError);
    });
  });

  // ── getCampaignStats ───────────────────────────────────────────────────────
  describe('getCampaignStats', () => {
    it('returns total, byStatus and recent', async () => {
      (db.smsCampaign.count as jest.Mock).mockResolvedValue(5);
      (db.smsCampaign.groupBy as jest.Mock).mockResolvedValue([
        { status: 'COMPLETED', _count: { status: 3 }, _sum: { sentCount: 30, failedCount: 2, totalCount: 32 } },
      ]);
      (db.smsCampaign.findMany as jest.Mock).mockResolvedValue([campaignFactory()]);

      const stats = await smsService.getCampaignStats('user-uuid-1');
      expect(stats.total).toBe(5);
      expect(stats.byStatus).toHaveLength(1);
      expect(stats.recent).toHaveLength(1);
    });
  });
});
