import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { ResponseHelper } from '../../shared/utils/response';

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      ResponseHelper.created(res, result, 'Registration successful');
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.login(req.body);
      ResponseHelper.success(res, result, 'Login successful');
    } catch (err) {
      next(err);
    }
  };

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const profile = await this.authService.getProfile(req.user!.userId);
      ResponseHelper.success(res, profile);
    } catch (err) {
      next(err);
    }
  };
}
