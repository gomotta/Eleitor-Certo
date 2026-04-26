import { Response, NextFunction } from 'express';
import { CandidateService } from '../services/candidate.service';
import { candidateSchema } from '../validators/candidate.validator';
import type { AuthRequest } from '../middlewares/authenticate';

type ParsedCandidate = Parameters<typeof CandidateService.upsert>[1];

export const CandidateController = {
  async upsert(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const input = candidateSchema.parse(req.body) as ParsedCandidate;
      const candidate = await CandidateService.upsert(req.userId!, input);
      res.status(201).json(candidate);
    } catch (err) {
      next(err);
    }
  },

  async getMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const candidate = await CandidateService.getByUserId(req.userId!);
      res.json(candidate);
    } catch (err) {
      next(err);
    }
  },

  async exportData(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await CandidateService.exportData(req.userId!);
      res.json(data);
    } catch (err) {
      next(err);
    }
  },

  async deleteMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await CandidateService.delete(req.userId!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
