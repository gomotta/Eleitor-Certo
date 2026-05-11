import { Request, Response, NextFunction } from 'express';
import { AiService } from '../services/ai.service';

export const AiController = {
  async query(req: Request, res: Response, next: NextFunction) {
    try {
      const { prompt, context, history } = req.body ?? {};
      if (typeof prompt !== 'string') {
        res.status(400).json({ error: 'Campo "prompt" obrigatório (string)' });
        return;
      }
      const result = await AiService.query(prompt, context, Array.isArray(history) ? history : undefined);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
};
