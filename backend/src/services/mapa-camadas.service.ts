import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import prisma from '../database/prisma';
import redis from '../database/redis';
import { AppError } from '../middlewares/errorHandler';

const CACHE_TTL_VOTOS = 60 * 60;       // 1h
const CACHE_TTL_MALHAS = 60 * 60 * 24; // 24h

// In-memory cache
const memCache = new Map<string, { data: unknown; expiresAt: number }>();
function memGet<T>(key: string): T | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.data as T;
}
function memSet(key: string, data: unknown, ttlSeconds: number) {
  memCache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}
async function redisGet<T>(key: string): Promise<T | null> {
  try { const raw = await redis.get(key); return raw ? (JSON.parse(raw) as T) : null; }
  catch { return null; }
}
async function redisSet(key: string, data: unknown, ttl: number) {
  try { await redis.setex(key, ttl, JSON.stringify(data)); } catch { /* optional */ }
}

interface IbgeRegiao { id: number; nome: string; }

interface IbgeMunicipio {
  id: number;
  nome: string;
  microrregiao: { id: number; nome: string; mesorregiao: { id: number; nome: string } };
}

const CARGO_MAP: Record<string, string> = {
  deputado_estadual: 'deputado estadual',
  deputado_federal: 'deputado federal',
  vereador: 'vereador',
  prefeito_vice: 'prefeito',
  senador: 'senador',
  governador_vice: 'governador',
  presidente_vice: 'presidente',
};

const ANO_POR_CARGO: Record<string, number> = {
  'deputado estadual': 2022, 'deputado federal': 2022, senador: 2022,
  governador: 2022, presidente: 2022, vereador: 2020, prefeito: 2020,
};

function extrairSiglaPartido(str: string | null): string {
  if (!str) return '';
  return str.split(/\s*[—–-]\s*/)[0].trim().toUpperCase();
}

// Fetch list of mesorregiões or microrregiões for a UF
async function getRegioes(uf: string, nivel: 'macro' | 'micro'): Promise<IbgeRegiao[]> {
  const endpoint = nivel === 'macro' ? 'mesorregioes' : 'microrregioes';
  const cacheKey = `ibge:regioes:${uf}:${nivel}`;
  const mem = memGet<IbgeRegiao[]>(cacheKey);
  if (mem) return mem;
  const red = await redisGet<IbgeRegiao[]>(cacheKey);
  if (red) { memSet(cacheKey, red, CACHE_TTL_MALHAS); return red; }

  const resp = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/${endpoint}`,
  );
  if (!resp.ok) throw new Error(`IBGE ${endpoint} ${uf} error ${resp.status}`);
  const data = (await resp.json()) as IbgeRegiao[];
  memSet(cacheKey, data, CACHE_TTL_MALHAS);
  await redisSet(cacheKey, data, CACHE_TTL_MALHAS);
  return data;
}

// Fetch TopoJSON malha for a single IBGE region ID → single GeoJSON feature
async function getMalhaRegiao(regiaoId: number): Promise<GeoJSON.Feature | null> {
  const cacheKey = `ibge:malha1:${regiaoId}`;
  const mem = memGet<GeoJSON.Feature>(cacheKey);
  if (mem) return mem;
  const red = await redisGet<GeoJSON.Feature>(cacheKey);
  if (red) { memSet(cacheKey, red, CACHE_TTL_MALHAS); return red; }

  try {
    const resp = await fetch(
      `https://servicodados.ibge.gov.br/api/v2/malhas/${regiaoId}?formato=application/json`,
    );
    if (!resp.ok) return null;
    const topo = (await resp.json()) as Topology;
    const objectName = Object.keys(topo.objects)[0];
    const fc = topojson.feature(
      topo,
      topo.objects[objectName] as GeometryCollection,
    ) as GeoJSON.FeatureCollection;
    const feature = fc.features[0] ?? null;
    if (feature) {
      memSet(cacheKey, feature, CACHE_TTL_MALHAS);
      await redisSet(cacheKey, feature, CACHE_TTL_MALHAS);
    }
    return feature;
  } catch {
    return null;
  }
}

// Fetch municipalities list (IBGE ID → micro/mesorregião mapping)
async function getLocalidades(uf: string): Promise<IbgeMunicipio[]> {
  const cacheKey = `ibge:loc:${uf}`;
  const mem = memGet<IbgeMunicipio[]>(cacheKey);
  if (mem) return mem;
  const red = await redisGet<IbgeMunicipio[]>(cacheKey);
  if (red) { memSet(cacheKey, red, CACHE_TTL_MALHAS); return red; }

  const resp = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
  );
  if (!resp.ok) throw new Error(`IBGE municípios ${uf} error ${resp.status}`);
  const data = (await resp.json()) as IbgeMunicipio[];
  memSet(cacheKey, data, CACHE_TTL_MALHAS);
  await redisSet(cacheKey, data, CACHE_TTL_MALHAS);
  return data;
}

// DB: TSE municipality code → IBGE municipality ID
async function getTseToIbgeMap(uf: string): Promise<Map<number, number>> {
  const rows = await prisma.$queryRaw<Array<{ id_municipio_tse: number; id_municipio: number }>>`
    SELECT DISTINCT id_municipio_tse, id_municipio
    FROM perfis_locais_votacao
    WHERE sigla_uf = ${uf} AND id_municipio IS NOT NULL
  `;
  return new Map(rows.map((r) => [r.id_municipio_tse, r.id_municipio]));
}

// DB: aggregate votes per municipality
async function queryVotosPorMunicipio(
  uf: string, cargoDb: string, ano: number, siglaPartido: string,
): Promise<Array<{ id_municipio_tse: number; votos_partido: number; votos_total: number }>> {
  try {
    return await prisma.$queryRaw`
      SELECT id_municipio_tse,
        SUM(CASE WHEN sigla_partido = ${siglaPartido} THEN votos ELSE 0 END)::int AS votos_partido,
        SUM(votos)::int AS votos_total
      FROM mv_votos_municipio
      WHERE sigla_uf = ${uf} AND cargo = ${cargoDb} AND ano = ${ano}
      GROUP BY id_municipio_tse
    `;
  } catch {
    return await prisma.$queryRaw`
      SELECT id_municipio_tse,
        SUM(CASE WHEN sigla_partido = ${siglaPartido} THEN votos ELSE 0 END)::int AS votos_partido,
        SUM(votos)::int AS votos_total
      FROM resultados_candidato_secao
      WHERE sigla_uf = ${uf} AND cargo = ${cargoDb} AND ano = ${ano}
      GROUP BY id_municipio_tse
    `;
  }
}

// Aggregate votes per macro or micro region
function aggregateVotosPorRegiao(
  votosRaw: Array<{ id_municipio_tse: number; votos_partido: number; votos_total: number }>,
  tseToIbge: Map<number, number>,
  localidades: IbgeMunicipio[],
  nivel: 'macro' | 'micro',
): Map<number, { votosPartido: number; votosTotal: number }> {
  const ibgeToRegiaoId = new Map<number, number>();
  for (const m of localidades) {
    const regiaoId = nivel === 'macro'
      ? m.microrregiao.mesorregiao.id
      : m.microrregiao.id;
    ibgeToRegiaoId.set(m.id, regiaoId);
  }

  const result = new Map<number, { votosPartido: number; votosTotal: number }>();
  for (const r of votosRaw) {
    const ibgeId = tseToIbge.get(r.id_municipio_tse);
    if (!ibgeId) continue;
    const regiaoId = ibgeToRegiaoId.get(ibgeId);
    if (!regiaoId) continue;
    const acc = result.get(regiaoId) ?? { votosPartido: 0, votosTotal: 0 };
    acc.votosPartido += Number(r.votos_partido);
    acc.votosTotal += Number(r.votos_total);
    result.set(regiaoId, acc);
  }
  return result;
}

export function invalidarCacheCamadas(candidatoId: string): void {
  const keys = [`camadas:v2:macro:${candidatoId}`, `camadas:v2:micro:${candidatoId}`];
  keys.forEach((k) => {
    memCache.delete(k);
    redis.del(k).catch(() => null);
  });
}

export const MapaCamadasService = {
  async getCopilotoInfo(candidatoId: string) {
    const copiloto = await prisma.copiloto.findUnique({
      where: { id: candidatoId },
      select: { partido: true, cargo: true, estado: true, microrregiao: true, macrorregiao: true, nome_urna: true },
    });
    if (!copiloto?.cargo || !copiloto.estado) {
      throw new AppError('Candidato sem perfil completo', 404);
    }
    const cargoDb = CARGO_MAP[copiloto.cargo] ?? copiloto.cargo.replace(/_/g, ' ');
    const siglaPartido = extrairSiglaPartido(copiloto.partido);
    const ano = ANO_POR_CARGO[cargoDb] ?? 2022;
    const uf = copiloto.estado.toUpperCase();
    return { cargoDb, siglaPartido, ano, uf, copiloto };
  },

  async getCamadaPoligono(candidatoId: string, nivel: 'macro' | 'micro') {
    const cacheKey = `camadas:v2:${nivel}:${candidatoId}`;
    const mem = memGet<object>(cacheKey);
    if (mem) return mem;
    const red = await redisGet<object>(cacheKey);
    if (red) { memSet(cacheKey, red, CACHE_TTL_VOTOS); return red; }

    const { cargoDb, siglaPartido, ano, uf } = await this.getCopilotoInfo(candidatoId);

    // Fetch everything in parallel: region list, municipality list, votes, TSE→IBGE map
    const [regioes, localidades, votosRaw, tseToIbge] = await Promise.all([
      getRegioes(uf, nivel),
      getLocalidades(uf),
      queryVotosPorMunicipio(uf, cargoDb, ano, siglaPartido),
      getTseToIbgeMap(uf),
    ]);

    // Aggregate votes per region ID
    const votosMap = aggregateVotosPorRegiao(votosRaw, tseToIbge, localidades, nivel);
    const totalVotosPartido = [...votosMap.values()].reduce((s, v) => s + v.votosPartido, 0);
    const maxVotos = Math.max(...[...votosMap.values()].map((v) => v.votosPartido), 1);

    // Fetch individual boundary polygons in parallel (cached per region ID)
    const featureResults = await Promise.all(
      regioes.map(async (r) => {
        const feature = await getMalhaRegiao(r.id);
        if (!feature) return null;
        const votos = votosMap.get(r.id) ?? { votosPartido: 0, votosTotal: 0 };
        const percentual = votos.votosTotal > 0
          ? (votos.votosPartido / votos.votosTotal) * 100
          : 0;
        return {
          ...feature,
          id: r.id,
          properties: {
            regiaoId: r.id,
            regiaoNome: r.nome,
            votosPartido: votos.votosPartido,
            votosTotal: votos.votosTotal,
            percentual: Math.round(percentual * 100) / 100,
            intensidade: votos.votosPartido / maxVotos,
          },
        };
      }),
    );

    const features = featureResults.filter((f): f is NonNullable<typeof f> => f !== null);

    const result = {
      type: 'FeatureCollection' as const,
      features,
      metadata: { nivel, partido: siglaPartido, cargo: cargoDb, uf, ano, totalVotosPartido, totalRegioes: features.length },
    };

    memSet(cacheKey, result, CACHE_TTL_VOTOS);
    await redisSet(cacheKey, result, CACHE_TTL_VOTOS);
    return result;
  },

  async getCamadaZona(candidatoId: string, municipioTse: number) {
    // Kept for future use — currently not rendered in frontend
    const { cargoDb, siglaPartido, ano, uf } = await this.getCopilotoInfo(candidatoId);
    const rows = await prisma.$queryRaw<Array<{ zona: string; votos_partido: number; votos_total: number; lat: number; lng: number }>>`
      SELECT r.zona,
        SUM(CASE WHEN r.sigla_partido = ${siglaPartido} THEN r.votos ELSE 0 END)::int AS votos_partido,
        SUM(r.votos)::int AS votos_total,
        AVG(p.latitude)::float AS lat,
        AVG(p.longitude)::float AS lng
      FROM resultados_candidato_secao r
      JOIN perfis_locais_votacao p
        ON p.id_municipio_tse = r.id_municipio_tse AND p.zona = r.zona AND p.sigla_uf = r.sigla_uf
      WHERE r.id_municipio_tse = ${municipioTse} AND r.cargo = ${cargoDb}
        AND r.ano = ${ano} AND r.turno = 1
        AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
      GROUP BY r.zona ORDER BY votos_partido DESC
    `;
    const maxVotos = Math.max(...rows.map((z) => Number(z.votos_partido)), 1);
    return {
      type: 'FeatureCollection' as const,
      features: rows.filter((z) => z.lat && z.lng).map((z) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [z.lng, z.lat] },
        properties: {
          zona: z.zona,
          votosPartido: Number(z.votos_partido),
          votosTotal: Number(z.votos_total),
          percentual: Number(z.votos_total) > 0
            ? Math.round((Number(z.votos_partido) / Number(z.votos_total)) * 10000) / 100 : 0,
          intensidade: Number(z.votos_partido) / maxVotos,
        },
      })),
      metadata: { nivel: 'zona' as const, partido: siglaPartido, cargo: cargoDb, uf, ano, municipioTse },
    };
  },
};
