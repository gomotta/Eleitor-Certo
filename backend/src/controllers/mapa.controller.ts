import { Request, Response, NextFunction } from 'express';
import { MapaService } from '../services/mapa.service';
import { MapaCamadasService } from '../services/mapa-camadas.service';

export const MapaController = {
  async getDados(req: Request, res: Response, next: NextFunction) {
    try {
      const { candidato_id, ano, cargo } = req.query;
      if (!candidato_id || typeof candidato_id !== 'string') {
        res.status(400).json({ error: 'Parâmetro candidato_id obrigatório' });
        return;
      }
      const anoOverride = ano ? Number(ano) : undefined;
      const cargoOverride = typeof cargo === 'string' ? cargo : undefined;
      const dados = await MapaService.getDados(candidato_id, anoOverride, cargoOverride);
      res.json(dados);
    } catch (err) {
      next(err);
    }
  },

  async getFilteredDados(req: Request, res: Response, next: NextFunction) {
    try {
      const { candidato_id, estado, partido, ideologia, candidato_sequencial, candidato_nome_urna, cargo } = req.query;
      if (!candidato_id || typeof candidato_id !== 'string') {
        res.status(400).json({ error: 'Parâmetro candidato_id obrigatório' });
        return;
      }
      const dados = await MapaService.getFilteredDados(candidato_id, {
        estado: estado as string | undefined,
        partido: partido as string | undefined,
        ideologia: ideologia as string | undefined,
        candidatoSequencial: candidato_sequencial as string | undefined,
        candidatoNomeUrna: candidato_nome_urna as string | undefined,
        cargo: cargo as string | undefined,
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

  async getMunicipioCandidatosPorPartido(req: Request, res: Response, next: NextFunction) {
    try {
      const tse = Number(req.params.tse);
      const sigla = String(req.params.sigla || '').toUpperCase();
      const { uf, cargo, ano } = req.query;
      if (isNaN(tse) || !sigla || !uf || !cargo || !ano) {
        res.status(400).json({ error: 'Parâmetros obrigatórios: tse, sigla, uf, cargo, ano' });
        return;
      }
      const detalhes = await MapaService.getMunicipioCandidatosPorPartido(
        tse,
        String(uf),
        String(cargo),
        Number(ano),
        sigla,
      );
      res.json(detalhes);
    } catch (err) {
      next(err);
    }
  },

  async getCamada(req: Request, res: Response, next: NextFunction) {
    try {
      const { candidato_id, nivel, municipio_tse, ano } = req.query;
      if (!candidato_id || typeof candidato_id !== 'string') {
        res.status(400).json({ error: 'Parâmetro candidato_id obrigatório' });
        return;
      }
      const anoOverride = ano ? Number(ano) : undefined;
      if (nivel === 'zona') {
        const tse = Number(municipio_tse);
        if (isNaN(tse)) {
          res.status(400).json({ error: 'municipio_tse obrigatório para nivel=zona' });
          return;
        }
        const dados = await MapaCamadasService.getCamadaZona(candidato_id, tse);
        res.json(dados);
      } else if (nivel === 'macro' || nivel === 'micro') {
        const dados = await MapaCamadasService.getCamadaPoligono(candidato_id, nivel, anoOverride);
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

  // ── Ranking endpoints ─────────────────────────────────────────────────────

  async getRankingPartidos(req: Request, res: Response, next: NextFunction) {
    try {
      const { uf, cargo, ano, municipios } = req.query;
      if (!uf || !cargo || !ano) {
        res.status(400).json({ error: 'Parâmetros obrigatórios: uf, cargo, ano' });
        return;
      }
      const muniList = typeof municipios === 'string' && municipios.length > 0
        ? municipios.split(',').map((s) => Number(s)).filter((n) => !isNaN(n))
        : undefined;
      const data = await MapaService.getRankingPartidos(
        String(uf), String(cargo), Number(ano),
        muniList && muniList.length > 0 ? muniList : undefined,
      );
      res.json(data);
    } catch (err) {
      next(err);
    }
  },

  async getRankingCandidatos(req: Request, res: Response, next: NextFunction) {
    try {
      const { uf, cargo, ano, partido, municipio_tse, municipios } = req.query;
      if (!uf || !cargo || !ano) {
        res.status(400).json({ error: 'Parâmetros obrigatórios: uf, cargo, ano' });
        return;
      }
      const muniTse = municipio_tse ? Number(municipio_tse) : undefined;
      const muniList = typeof municipios === 'string' && municipios.length > 0
        ? municipios.split(',').map((s) => Number(s)).filter((n) => !isNaN(n))
        : undefined;
      const data = await MapaService.getRankingCandidatos(
        String(uf), String(cargo), Number(ano),
        partido ? String(partido) : undefined,
        muniTse && !isNaN(muniTse) ? muniTse : undefined,
        muniList && muniList.length > 0 ? muniList : undefined,
      );
      // Convert BigInt sequencial to string for JSON serialization
      const serializable = (data as any[]).map((r) => ({
        ...r,
        sequencial: r.sequencial != null ? String(r.sequencial) : null,
      }));
      res.json(serializable);
    } catch (err) {
      next(err);
    }
  },

  async getVotosPorMunicipio(req: Request, res: Response, next: NextFunction) {
    try {
      const { uf, cargo, ano, partido, sequencial } = req.query;
      if (!uf || !cargo || !ano) {
        res.status(400).json({ error: 'Parâmetros obrigatórios: uf, cargo, ano' });
        return;
      }
      const data = await MapaService.getVotosPorMunicipio(
        String(uf), String(cargo), Number(ano),
        {
          partido: partido ? String(partido) : undefined,
          sequencial: sequencial ? String(sequencial) : undefined,
        },
      );
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
};
