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
      const { candidato_id, estado, partido, ideologia, candidato_sequencial, candidato_nome_urna, cargo, ano } = req.query;
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
        ano: ano ? Number(ano) : undefined,
      });
      res.json(dados);
    } catch (err) {
      next(err);
    }
  },

  async getMunicipioDetalhes(req: Request, res: Response, next: NextFunction) {
    try {
      const tse = Number(req.params.tse);
      const { uf, cargo, ano, nome_local } = req.query;
      if (isNaN(tse) || !uf || !cargo || !ano) {
        res.status(400).json({ error: 'Parâmetros obrigatórios: tse, uf, cargo, ano' });
        return;
      }
      const detalhes = await MapaService.getMunicipioDetalhes(
        tse,
        String(uf),
        String(cargo),
        Number(ano),
        nome_local ? String(nome_local) : undefined,
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
        tse, String(uf), String(cargo), Number(ano), sigla,
      );
      const serializable = (detalhes as any[]).map((r) => ({
        ...r, sequencial: r.sequencial != null ? String(r.sequencial) : null,
      }));
      res.json(serializable);
    } catch (err) {
      next(err);
    }
  },

  async getMunicipioCandidatos(req: Request, res: Response, next: NextFunction) {
    try {
      const tse = Number(req.params.tse);
      const { uf, cargo, ano, partido, nome_local } = req.query;
      if (isNaN(tse) || !uf || !cargo || !ano) {
        res.status(400).json({ error: 'Parâmetros obrigatórios: tse, uf, cargo, ano' });
        return;
      }
      const data = await MapaService.getMunicipioCandidatos(
        tse, String(uf), String(cargo), Number(ano),
        partido ? String(partido).toUpperCase() : undefined,
        nome_local ? String(nome_local) : undefined,
      );
      const serializable = (data as any[]).map((r) => ({
        ...r, sequencial: r.sequencial != null ? String(r.sequencial) : null,
      }));
      res.json(serializable);
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

  async getRankingCargos(req: Request, res: Response, next: NextFunction) {
    try {
      const { uf, ano, municipios } = req.query;
      if (!uf || !ano) {
        res.status(400).json({ error: 'Parâmetros obrigatórios: uf, ano' });
        return;
      }
      const muniList = typeof municipios === 'string' && municipios.length > 0
        ? municipios.split(',').map((s) => Number(s)).filter((n) => !isNaN(n))
        : undefined;
      const data = await MapaService.getRankingCargos(
        String(uf), Number(ano),
        muniList && muniList.length > 0 ? muniList : undefined,
      );
      res.json(data);
    } catch (err) {
      next(err);
    }
  },

  async getRankingCargosLocal(req: Request, res: Response, next: NextFunction) {
    try {
      const { uf, municipio_tse, ano, nome_local, partido, sequencial } = req.query;
      if (!uf || !municipio_tse || !ano || !nome_local) {
        res.status(400).json({ error: 'Parâmetros obrigatórios: uf, municipio_tse, ano, nome_local' });
        return;
      }
      const data = await MapaService.getRankingCargosLocal(
        String(uf).toUpperCase(),
        Number(municipio_tse),
        Number(ano),
        String(nome_local),
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

  async getRankingLocais(req: Request, res: Response, next: NextFunction) {
    try {
      const { uf, municipio_tse, cargo, ano, partido, sequencial } = req.query;
      if (!uf || !municipio_tse || !cargo || !ano) {
        res.status(400).json({ error: 'Parâmetros obrigatórios: uf, municipio_tse, cargo, ano' });
        return;
      }
      const data = await MapaService.getRankingLocais(
        String(uf).toUpperCase(),
        Number(municipio_tse),
        String(cargo),
        Number(ano),
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
