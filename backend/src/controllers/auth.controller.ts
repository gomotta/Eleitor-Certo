import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { registerSchema, loginSchema, refreshSchema } from '../validators/auth.validator';

export const AuthController = {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const input = registerSchema.parse(req.body);
      const tokens = await AuthService.register(input);
      res.status(201).json(tokens);
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const input = loginSchema.parse(req.body);
      const tokens = await AuthService.login(input);
      res.json(tokens);
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = refreshSchema.parse(req.body);
      const result = await AuthService.refresh(refreshToken);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
