import { Response, NextFunction } from 'express';
import { CaboEleitoralService } from '../services/cabo-eleitoral.service';
import type { AuthRequest } from '../middlewares/authenticate';

export const CaboEleitoralController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const cabo = await CaboEleitoralService.create(req.userId!, req.body);
      res.status(201).json(cabo);
    } catch (err) {
      next(err);
    }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await CaboEleitoralService.list(req.userId!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const cabo = await CaboEleitoralService.getById(String(req.params.id), req.userId!);
      res.json(cabo);
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const cabo = await CaboEleitoralService.update(String(req.params.id), req.userId!, req.body);
      res.json(cabo);
    } catch (err) {
      next(err);
    }
  },

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await CaboEleitoralService.delete(String(req.params.id), req.userId!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async addHistorico(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const historico = await CaboEleitoralService.addHistorico(
        String(req.params.id),
        req.userId!,
        req.body,
      );
      res.status(201).json(historico);
    } catch (err) {
      next(err);
    }
  },

  async updateHistorico(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const historico = await CaboEleitoralService.updateHistorico(
        String(req.params.hid),
        req.userId!,
        req.body,
      );
      res.json(historico);
    } catch (err) {
      next(err);
    }
  },

  async removeHistorico(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await CaboEleitoralService.deleteHistorico(String(req.params.hid), req.userId!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async searchCandidatos(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { q = '', ano, municipio_tse } = req.query as { q?: string; ano?: string; municipio_tse?: string };
      const candidatos = await CaboEleitoralService.searchCandidatos(
        q,
        ano ? Number(ano) : undefined,
        municipio_tse ? Number(municipio_tse) : undefined,
      );
      res.json(candidatos);
    } catch (err) {
      next(err);
    }
  },

  async searchLocaisVotacao(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { q = '', municipio_tse, ano } = req.query as { q?: string; municipio_tse?: string; ano?: string };
      if (!municipio_tse || !ano) return res.json([]);
      const locais = await CaboEleitoralService.searchLocaisVotacao(q, Number(municipio_tse), Number(ano));
      res.json(locais);
    } catch (err) {
      next(err);
    }
  },

  async searchMunicipios(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { q = '', uf } = req.query as { q?: string; uf?: string };
      const municipios = await CaboEleitoralService.searchMunicipios(q, uf);
      res.json(municipios);
    } catch (err) {
      next(err);
    }
  },

  async resolveMunicipio(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const tseId = Number(req.params.tseId);
      const municipio = await CaboEleitoralService.resolveMunicipioPorTse(tseId);
      if (!municipio) return res.status(404).json({ error: 'Município não encontrado' });
      res.json(municipio);
    } catch (err) {
      next(err);
    }
  },
};
