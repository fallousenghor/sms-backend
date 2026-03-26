import pLimit from 'p-limit';
import { prisma } from '../../shared/config/prisma';
import { config } from '../../shared/config';
import { TwilioService } from './twilio.service';
import { NotFoundError, ValidationError } from '../../shared/utils/errors';
import { buildPaginationMeta } from '../../shared/utils/response';
import { SendSmsDto, SendSingleSmsDto, CampaignFilters, SmsDeliveryResult } from './sms.types';
import { logger } from '../../shared/utils/logger';

export class SmsService {
  constructor(private readonly twilioService: TwilioService) {}

  async sendSingle(dto: SendSingleSmsDto) {
    const result = await this.twilioService.sendSms(dto.phone, dto.message);
    return { phone: dto.phone, status: result.status, sid: result.sid, errorMessage: result.errorMessage };
  }

  async createCampaign(userId: string, dto: SendSmsDto) {
    const clients = await this.resolveTargetClients(dto);
    if (clients.length === 0) throw new ValidationError('No active clients found for the selected target');

    const campaign = await prisma.smsCampaign.create({
      data: {
        name: dto.campaignName || `Campaign ${new Date().toLocaleString('fr-FR')}`,
        message: dto.message,
        status: 'PENDING',
        totalCount: clients.length,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        userId,
        groupId: dto.groupId || null,
      },
    });

    if (dto.scheduledAt) {
      logger.info(`Campaign ${campaign.id} scheduled for ${dto.scheduledAt}`);
      return { campaign, dispatched: false };
    }

    this.dispatchCampaign(campaign.id, clients, dto.message).catch((err) =>
      logger.error(`Campaign ${campaign.id} dispatch error:`, err)
    );

    return { campaign, dispatched: true };
  }

  private async dispatchCampaign(
    campaignId: string,
    clients: Array<{ id: string; phone: string }>,
    message: string
  ): Promise<void> {
    logger.info(`Dispatching campaign ${campaignId} to ${clients.length} clients`);

    await prisma.smsCampaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    const limit = pLimit(config.sms.batchSize);
    let sentCount = 0;
    let failedCount = 0;

    const tasks = clients.map((client) =>
      limit(async (): Promise<SmsDeliveryResult> => {
        const result = await this.twilioService.sendSms(client.phone, message);
        const isSuccess = !result.errorCode;

        await prisma.smsLog.create({
          data: {
            campaignId,
            clientId: client.id,
            status: isSuccess ? 'SENT' : 'FAILED',
            twilioSid: result.sid || null,
            errorCode: result.errorCode || null,
            errorMessage: result.errorMessage || null,
            sentAt: isSuccess ? new Date() : null,
          },
        });

        if (isSuccess) sentCount++;
        else failedCount++;

        return {
          clientId: client.id,
          phone: client.phone,
          status: isSuccess ? 'SENT' : 'FAILED',
          twilioSid: result.sid,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
        };
      })
    );

    try {
      await Promise.all(tasks);
      await prisma.smsCampaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED', sentCount, failedCount, completedAt: new Date() },
      });
      logger.info(`Campaign ${campaignId} completed: ${sentCount} sent, ${failedCount} failed`);
    } catch (err) {
      logger.error(`Campaign ${campaignId} fatal error:`, err);
      await prisma.smsCampaign.update({ where: { id: campaignId }, data: { status: 'FAILED' } });
    }
  }

  private async resolveTargetClients(dto: SendSmsDto): Promise<Array<{ id: string; phone: string }>> {
    const where: Record<string, unknown> = { isActive: true };

    if (dto.sendToAll) {
      // all active clients
    } else if (dto.groupId) {
      where.groups = { some: { groupId: dto.groupId } };
    } else if (dto.clientIds && dto.clientIds.length > 0) {
      where.id = { in: dto.clientIds };
    } else {
      throw new ValidationError('Specify clientIds, groupId, or sendToAll=true');
    }

    return prisma.client.findMany({ where, select: { id: true, phone: true } });
  }

  async getCampaigns(userId: string, filters: CampaignFilters) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = { userId };
    if (filters.status) where.status = filters.status;

    const [campaigns, total] = await Promise.all([
      prisma.smsCampaign.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          group: { select: { id: true, name: true, color: true } },
          _count: { select: { smsLogs: true } },
        },
      }),
      prisma.smsCampaign.count({ where }),
    ]);

    return { campaigns, meta: buildPaginationMeta(total, page, limit) };
  }

  async getCampaignById(campaignId: string, userId: string) {
    const campaign = await prisma.smsCampaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        group: true,
        smsLogs: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: { client: { select: { id: true, firstName: true, lastName: true, phone: true } } },
        },
      },
    });
    if (!campaign) throw new NotFoundError('Campaign');
    return campaign;
  }

  async cancelCampaign(campaignId: string, userId: string) {
    const campaign = await prisma.smsCampaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new NotFoundError('Campaign');
    if (campaign.status !== 'PENDING') throw new ValidationError('Only PENDING campaigns can be cancelled');

    return prisma.smsCampaign.update({ where: { id: campaignId }, data: { status: 'CANCELLED' } });
  }

  async getCampaignStats(userId: string) {
    const [total, byStatus, recent] = await Promise.all([
      prisma.smsCampaign.count({ where: { userId } }),
      prisma.smsCampaign.groupBy({
        by: ['status'],
        where: { userId },
        _count: { status: true },
        _sum: { sentCount: true, failedCount: true, totalCount: true },
      }),
      prisma.smsCampaign.findMany({
        where: { userId }, take: 5, orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, status: true, totalCount: true, sentCount: true, failedCount: true, createdAt: true },
      }),
    ]);
    return { total, byStatus, recent };
  }

  async getDeliveryReport(campaignId: string, userId: string) {
    const campaign = await prisma.smsCampaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new NotFoundError('Campaign');

    const logs = await prisma.smsLog.findMany({
      where: { campaignId },
      include: { client: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const byStatus = logs.reduce((acc: Record<string, number>, log: { status: string }) => {
      acc[log.status] = (acc[log.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      campaign: {
        id: campaign.id, name: campaign.name, message: campaign.message,
        status: campaign.status, totalCount: campaign.totalCount,
        sentCount: campaign.sentCount, failedCount: campaign.failedCount,
        startedAt: campaign.startedAt, completedAt: campaign.completedAt,
      },
      byStatus,
      logs,
    };
  }
}
