import { Request, Response, NextFunction } from 'express';
import { SmsService } from './sms.service';
import { ResponseHelper } from '../../shared/utils/response';

export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  sendSingle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.smsService.sendSingle(req.body);
      ResponseHelper.success(res, result, 'SMS sent');
    } catch (err) { next(err); }
  };

  createCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.smsService.createCampaign(req.user!.userId, req.body);
      ResponseHelper.created(
        res,
        result,
        result.dispatched ? 'Campaign started' : 'Campaign scheduled'
      );
    } catch (err) { next(err); }
  };

  getCampaigns = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = {
        status: req.query.status as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      };
      const { campaigns, meta } = await this.smsService.getCampaigns(req.user!.userId, filters);
      ResponseHelper.paginated(res, campaigns, meta);
    } catch (err) { next(err); }
  };

  getCampaignById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const campaign = await this.smsService.getCampaignById(req.params.id, req.user!.userId);
      ResponseHelper.success(res, campaign);
    } catch (err) { next(err); }
  };

  cancelCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const campaign = await this.smsService.cancelCampaign(req.params.id, req.user!.userId);
      ResponseHelper.success(res, campaign, 'Campaign cancelled');
    } catch (err) { next(err); }
  };

  getCampaignStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.smsService.getCampaignStats(req.user!.userId);
      ResponseHelper.success(res, stats);
    } catch (err) { next(err); }
  };

  getDeliveryReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = await this.smsService.getDeliveryReport(req.params.id, req.user!.userId);
      ResponseHelper.success(res, report);
    } catch (err) { next(err); }
  };
}
