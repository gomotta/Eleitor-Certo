import { Request, Response, NextFunction } from 'express';
import { GeoService } from '../services/geo.service';

export const GeoController = {
  async getEstados(_req: Request, res: Response, next: NextFunction) {
    try {
      const estados = await GeoService.getEstados();
      res.json(estados);
    } catch (err) {
      next(err);
    }
  },

  async getCidades(req: Request, res: Response, next: NextFunction) {
    try {
      const { uf } = req.query;
      if (!uf || typeof uf !== 'string') {
        res.status(400).json({ error: 'Parâmetro uf obrigatório' });
        return;
      }
      const cidades = await GeoService.getCidades(uf);
      res.json(cidades);
    } catch (err) {
      next(err);
    }
  },

  async getMacroRegioes(req: Request, res: Response, next: NextFunction) {
    try {
      const { uf } = req.query;
      if (!uf || typeof uf !== 'string') {
        res.status(400).json({ error: 'Parâmetro uf obrigatório' });
        return;
      }
      const regioes = await GeoService.getMacroRegioes(uf);
      res.json(regioes);
    } catch (err) {
      next(err);
    }
  },

  async getMicroRegioes(req: Request, res: Response, next: NextFunction) {
    try {
      const { macro } = req.query;
      if (!macro || isNaN(Number(macro))) {
        res.status(400).json({ error: 'Parâmetro macro (id numérico) obrigatório' });
        return;
      }
      const regioes = await GeoService.getMicroRegioes(Number(macro));
      res.json(regioes);
    } catch (err) {
      next(err);
    }
  },

  async getPartidos(_req: Request, res: Response, next: NextFunction) {
    try {
      const partidos = await GeoService.getPartidos();
      res.json(partidos);
    } catch (err) {
      next(err);
    }
  },
};
