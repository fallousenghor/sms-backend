import { Request, Response, NextFunction } from 'express';
import { ClientService } from './client.service';
import { ResponseHelper } from '../../shared/utils/response';
import { ValidationError } from '../../shared/utils/errors';

export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = await this.clientService.create(req.body);
      ResponseHelper.created(res, client, 'Client created successfully');
    } catch (err) {
      next(err);
    }
  };

  findAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const filters = {
        search: req.query.search as string,
        groupId: req.query.groupId as string,
        tags: req.query.tags ? String(req.query.tags).split(',') : undefined,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      };

      const { clients, meta } = await this.clientService.findAll(filters);
      ResponseHelper.paginated(res, clients, meta);
    } catch (err) {
      next(err);
    }
  };

  findById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = await this.clientService.findById(req.params.id);
      ResponseHelper.success(res, client);
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const client = await this.clientService.update(req.params.id, req.body);
      ResponseHelper.success(res, client, 'Client updated successfully');
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.clientService.delete(req.params.id);
      ResponseHelper.success(res, null, 'Client deleted successfully');
    } catch (err) {
      next(err);
    }
  };

  addToGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.clientService.addToGroup(req.params.id, req.params.groupId);
      ResponseHelper.success(res, null, 'Client added to group');
    } catch (err) {
      next(err);
    }
  };

  removeFromGroup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.clientService.removeFromGroup(req.params.id, req.params.groupId);
      ResponseHelper.success(res, null, 'Client removed from group');
    } catch (err) {
      next(err);
    }
  };

  bulkImport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        throw new ValidationError('Excel file is required');
      }
      const groupId = req.body.groupId as string | undefined;
      const result = await this.clientService.bulkImport(req.file.buffer, groupId);
      ResponseHelper.success(res, result, `Import completed: ${result.success} success, ${result.failed} failed`);
    } catch (err) {
      next(err);
    }
  };

  exportToExcel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const buffer = await this.clientService.exportToExcel();
      const filename = `clients_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  };

  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.clientService.getStats();
      ResponseHelper.success(res, stats);
    } catch (err) {
      next(err);
    }
  };
}
