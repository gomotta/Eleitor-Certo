import { Request, Response, NextFunction } from 'express';
import { MapaService } from '../services/mapa.service';
import { MapaCamadasService } from '../services/mapa-camadas.service';

export const MapaController = {
  async getDados(req: Request, res: Response, next: NextFunction) {
    try {
      const { candidato_id } = req.query;
      if (!candidato_id || typeof candidato_id !== 'string') {
        res.status(400).json({ error: 'Parâmetro candidato_id obrigatório' });
        return;
      }
      const dados = await MapaService.getDados(candidato_id);
      res.json(dados);
    } catch (err) {
      next(err);
    }
  },

  async getFilteredDados(req: Request, res: Response, next: NextFunction) {
    try {
      const { candidato_id, estado, partido, ideologia } = req.query;
      if (!candidato_id || typeof candidato_id !== 'string') {
        res.status(400).json({ error: 'Parâmetro candidato_id obrigatório' });
        return;
      }
      const dados = await MapaService.getFilteredDados(candidato_id, {
        estado: estado as string | undefined,
        partido: partido as string | undefined,
        ideologia: ideologia as string | undefined,
      });
      res.json(dados);
    } catch (err) {
      next(err);
    }
  },

  async getMunicipioDetalhes(req: Request, res: Response, next: NextFunction) {
    try {
      const tse = Number(req.params.tse);
      const { uf, cargo, ano } = req.query;
      if (isNaN(tse) || !uf || !cargo || !ano) {
        res.status(400).json({ error: 'Parâmetros obrigatórios: tse, uf, cargo, ano' });
        return;
      }
      const detalhes = await MapaService.getMunicipioDetalhes(
        tse,
        String(uf),
        String(cargo),
        Number(ano),
      );
      res.json(detalhes);
    } catch (err) {
      next(err);
    }
  },

  async getCamada(req: Request, res: Response, next: NextFunction) {
    try {
      const { candidato_id, nivel, municipio_tse } = req.query;
      if (!candidato_id || typeof candidato_id !== 'string') {
        res.status(400).json({ error: 'Parâmetro candidato_id obrigatório' });
        return;
      }
      if (nivel === 'zona') {
        const tse = Number(municipio_tse);
        if (isNaN(tse)) {
          res.status(400).json({ error: 'municipio_tse obrigatório para nivel=zona' });
          return;
        }
        const dados = await MapaCamadasService.getCamadaZona(candidato_id, tse);
        res.json(dados);
      } else if (nivel === 'macro' || nivel === 'micro') {
        const dados = await MapaCamadasService.getCamadaPoligono(candidato_id, nivel);
        res.json(dados);
      } else {
        res.status(400).json({ error: 'nivel deve ser macro, micro ou zona' });
      }
    } catch (err) {
      next(err);
    }
  },

  async getZonaDetalhes(req: Request, res: Response, next: NextFunction) {
    try {
      const zonaId = Number(req.params.id);
      if (isNaN(zonaId)) {
        res.status(400).json({ error: 'ID de zona inválido' });
        return;
      }
      // Legacy stub
      res.json([]);
    } catch (err) {
      next(err);
    }
  },

  async getComparativo(req: Request, res: Response, next: NextFunction) {
    try {
      const { candidatos } = req.query;
      if (!candidatos || typeof candidatos !== 'string') {
        res.status(400).json({ error: 'Parâmetro candidatos obrigatório' });
        return;
      }
      const ids = candidatos.split(',').filter(Boolean);
      const dados = await Promise.all(ids.map((id) => MapaService.getDados(id)));
      res.json(ids.map((id, i) => ({ candidatoId: id, dados: dados[i] })));
    } catch (err) {
      next(err);
    }
  },
};
