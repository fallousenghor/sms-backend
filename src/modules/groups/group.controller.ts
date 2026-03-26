import { Request, Response, NextFunction } from 'express';
import { GroupService } from './group.service';
import { ResponseHelper } from '../../shared/utils/response';

export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const group = await this.groupService.create(req.body);
      ResponseHelper.created(res, group, 'Group created successfully');
    } catch (err) { next(err); }
  };

  findAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const { groups, meta } = await this.groupService.findAll(page, limit);
      ResponseHelper.paginated(res, groups, meta);
    } catch (err) { next(err); }
  };

  findById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const group = await this.groupService.findById(req.params.id);
      ResponseHelper.success(res, group);
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const group = await this.groupService.update(req.params.id, req.body);
      ResponseHelper.success(res, group, 'Group updated successfully');
    } catch (err) { next(err); }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.groupService.delete(req.params.id);
      ResponseHelper.success(res, null, 'Group deleted successfully');
    } catch (err) { next(err); }
  };

  getGroupClients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const { clients, meta } = await this.groupService.getGroupClients(req.params.id, page, limit);
      ResponseHelper.paginated(res, clients, meta);
    } catch (err) { next(err); }
  };
}
