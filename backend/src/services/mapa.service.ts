import { Prisma } from '@prisma/client';
import prisma from '../database/prisma';
import redis from '../database/redis';
import { AppError } from '../middlewares/errorHandler';

const CACHE_TTL = 60 * 60; // 1h

// In-memory cache: chave → { data, expiresAt }
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

// Cache de nomes e micro regiões de municípios TSE→valor por UF
// Cache: UF → { nomesMap, microMap }. Promise cached so concurrent calls share the same fetch.
const nomesPromiseCache = new Map<string, Promise<{ nomesMap: Map<number, string>; microMap: Map<number, number> }>>();

async function fetchNomesMap(uf: string): Promise<{ nomesMap: Map<number, string>; microMap: Map<number, number> }> {
  if (nomesPromiseCache.has(uf)) return nomesPromiseCache.get(uf)!;

  const promise = Promise.all([
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`),
    prisma.$queryRaw<Array<{ id_municipio_tse: number; id_municipio: number }>>`
      SELECT DISTINCT id_municipio_tse, id_municipio
      FROM perfis_locais_votacao
      WHERE sigla_uf = ${uf} AND id_municipio IS NOT NULL
    `,
  ]).then(async ([ibgeResp, ibgeCodesRaw]) => {
    const nomesMap = new Map<number, string>();
    const microMap = new Map<number, number>();
    if (ibgeResp.ok) {
      const ibgeMunicipios = (await ibgeResp.json()) as Array<{
        id: number;
        nome: string;
        microrregiao: { id: number };
      }>;
      const ibgeNomeMap = new Map(ibgeMunicipios.map((m) => [m.id, m.nome]));
      const ibgeMicroMap = new Map(ibgeMunicipios.map((m) => [m.id, m.microrregiao.id]));
      ibgeCodesRaw.forEach((r) => {
        const nome = ibgeNomeMap.get(r.id_municipio);
        if (nome) nomesMap.set(r.id_municipio_tse, nome);
        const microId = ibgeMicroMap.get(r.id_municipio);
        if (microId) microMap.set(r.id_municipio_tse, microId);
      });
    }
    return { nomesMap, microMap };
  }).catch(() => ({ nomesMap: new Map<number, string>(), microMap: new Map<number, number>() }));

  nomesPromiseCache.set(uf, promise);
  return promise;
}

// Cargo do copiloto (lowercase, underscore) → cargo no banco (lowercase, espaço)
const CARGO_MAP: Record<string, string> = {
  deputado_estadual: 'deputado estadual',
  deputado_federal: 'deputado federal',
  vereador: 'vereador',
  prefeito_vice: 'prefeito',
  senador: 'senador',
  governador_vice: 'governador',
  presidente_vice: 'presidente',
};

// Eleição mais recente por cargo
const ANO_POR_CARGO: Record<string, number> = {
  'deputado estadual': 2022,
  'deputado federal': 2022,
  senador: 2022,
  governador: 2022,
  presidente: 2022,
  vereador: 2020,
  prefeito: 2020,
};

function extrairSiglaPartido(partidoStr: string | null): string {
  if (!partidoStr) return '';
  return partidoStr.split(/\s*[—–-]\s*/)[0].trim().toUpperCase();
}

async function queryVotos(
  uf: string,
  cargoDb: string,
  ano: number,
  siglaPartido: string,
): Promise<Array<{ id_municipio_tse: number; votos_partido: number; votos_total: number }>> {
  // Tenta a materialized view primeiro
  try {
    return await prisma.$queryRaw`
      SELECT
        id_municipio_tse,
        SUM(CASE WHEN sigla_partido = ${siglaPartido} THEN votos ELSE 0 END)::int AS votos_partido,
        SUM(votos)::int AS votos_total
      FROM mv_votos_municipio
      WHERE sigla_uf = ${uf} AND cargo = ${cargoDb} AND ano = ${ano}
      GROUP BY id_municipio_tse
    `;
  } catch {
    // Fallback: tabela original (lenta para primeira consulta)
    return await prisma.$queryRaw`
      SELECT
        id_municipio_tse,
        SUM(CASE WHEN sigla_partido = ${siglaPartido} THEN votos ELSE 0 END)::int AS votos_partido,
        SUM(votos)::int AS votos_total
      FROM resultados_candidato_secao
      WHERE sigla_uf = ${uf} AND cargo = ${cargoDb} AND ano = ${ano}
      GROUP BY id_municipio_tse
    `;
  }
}

async function queryVotosPorIdeologia(
  uf: string,
  cargoDb: string,
  ano: number,
  ideologia: string,
): Promise<Array<{ id_municipio_tse: number; votos_partido: number; votos_total: number }>> {
  const partidosDaIdeologia = await prisma.partidos.findMany({
    where: { ideologia },
    select: { sigla: true },
  });
  if (partidosDaIdeologia.length === 0) return [];
  const siglas = partidosDaIdeologia.map((p) => p.sigla);

  try {
    return await prisma.$queryRaw`
      SELECT id_municipio_tse,
        SUM(CASE WHEN sigla_partido IN (${Prisma.join(siglas)}) THEN votos ELSE 0 END)::int AS votos_partido,
        SUM(votos)::int AS votos_total
      FROM mv_votos_municipio
      WHERE sigla_uf = ${uf} AND cargo = ${cargoDb} AND ano = ${ano}
      GROUP BY id_municipio_tse
    `;
  } catch {
    return await prisma.$queryRaw`
      SELECT id_municipio_tse,
        SUM(CASE WHEN sigla_partido IN (${Prisma.join(siglas)}) THEN votos ELSE 0 END)::int AS votos_partido,
        SUM(votos)::int AS votos_total
      FROM resultados_candidato_secao
      WHERE sigla_uf = ${uf} AND cargo = ${cargoDb} AND ano = ${ano}
      GROUP BY id_municipio_tse
    `;
  }
}

export function invalidarCacheMapaDados(candidatoId: string): void {
  const key = `mapa:v2:${candidatoId}`;
  memCache.delete(key);
  redis.del(key).catch(() => null);
}

export const MapaService = {
  async getDados(candidatoId: string) {
    const cacheKey = `mapa:v2:${candidatoId}`;

    // 1. Tenta memória
    const memHit = memGet<object>(cacheKey);
    if (memHit) return memHit;

    // 2. Tenta Redis
    const redisHit = await redis.get(cacheKey).catch(() => null);
    if (redisHit) {
      const parsed = JSON.parse(redisHit);
      memSet(cacheKey, parsed, CACHE_TTL);
      return parsed;
    }

    const copiloto = await prisma.copiloto.findUnique({
      where: { id: candidatoId },
      select: {
        partido: true,
        cargo: true,
        estado: true,
        microrregiao: true,
        macrorregiao: true,
        nome_urna: true,
      },
    });

    if (!copiloto || !copiloto.cargo || !copiloto.estado) {
      throw new AppError('Candidato sem perfil completo', 404);
    }

    const cargoDb = CARGO_MAP[copiloto.cargo] ?? copiloto.cargo.replace(/_/g, ' ');
    const siglaPartido = extrairSiglaPartido(copiloto.partido);
    const ano = ANO_POR_CARGO[cargoDb] ?? 2022;
    const uf = copiloto.estado.toUpperCase();

    const [votosRaw, centroidsRaw] = await Promise.all([
      queryVotos(uf, cargoDb, ano, siglaPartido),
      prisma.$queryRaw<Array<{ id_municipio_tse: number; id_municipio: number | null; lat: number; lng: number }>>`
        SELECT
          id_municipio_tse,
          MIN(id_municipio) AS id_municipio,
          AVG(latitude)::float AS lat,
          AVG(longitude)::float AS lng
        FROM perfis_locais_votacao
        WHERE sigla_uf = ${uf} AND latitude IS NOT NULL AND longitude IS NOT NULL
        GROUP BY id_municipio_tse
      `,
    ]);

    const centroidsMap = new Map(centroidsRaw.map((c) => [c.id_municipio_tse, c]));

    // Awaits names + microRegiaoId mapping (cached Promise — subsequent calls are instant)
    const { nomesMap, microMap } = await fetchNomesMap(uf);

    // Ranking por votos do partido
    const sorted = [...votosRaw].sort((a, b) => b.votos_partido - a.votos_partido);
    const rankingMap = new Map(sorted.map((r, i) => [r.id_municipio_tse, i + 1]));
    const totalVotosPartido = sorted.reduce((sum, r) => sum + r.votos_partido, 0);

    const features = votosRaw
      .map((r) => {
        const c = centroidsMap.get(r.id_municipio_tse);
        if (!c?.lat || !c?.lng) return null;
        const percentual = r.votos_total > 0 ? (r.votos_partido / r.votos_total) * 100 : 0;
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
          properties: {
            municipioTse: r.id_municipio_tse,
            municipioIbge: c.id_municipio ?? null,
            municipioNome: nomesMap.get(r.id_municipio_tse) ?? String(r.id_municipio_tse),
            microRegiaoId: microMap.get(r.id_municipio_tse) ?? null,
            uf,
            votosPartido: r.votos_partido,
            votosTotal: r.votos_total,
            percentual: Math.round(percentual * 100) / 100,
            ranking: rankingMap.get(r.id_municipio_tse) ?? 0,
            lat: c.lat,
            lng: c.lng,
          },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    const geojson = {
      type: 'FeatureCollection' as const,
      features,
      metadata: {
        partido: siglaPartido,
        cargo: cargoDb,
        uf,
        ano,
        totalMunicipios: features.length,
        totalVotosPartido,
        nomeUrna: copiloto.nome_urna,
        microrregiao: copiloto.microrregiao,
        macrorregiao: copiloto.macrorregiao,
      },
    };

    memSet(cacheKey, geojson, CACHE_TTL);
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(geojson)).catch(() => null);
    return geojson;
  },

  async getFilteredDados(
    candidatoId: string,
    opts: { estado?: string; partido?: string; ideologia?: string; candidatoNome?: string; candidatoNumero?: string },
  ) {
    const uf = (opts.estado?.toUpperCase() || undefined);
    const partidoOverride = opts.partido?.toUpperCase() || undefined;
    const ideologia = opts.ideologia?.trim() || undefined;
    const candidatoNome = opts.candidatoNome?.trim() || undefined;
    const candidatoNumero = opts.candidatoNumero?.trim() || undefined;

    const copiloto = await prisma.copiloto.findUnique({
      where: { id: candidatoId },
      select: { partido: true, cargo: true, estado: true, microrregiao: true, macrorregiao: true, nome_urna: true },
    });
    if (!copiloto || !copiloto.cargo || !copiloto.estado) {
      throw new AppError('Candidato sem perfil completo', 404);
    }

    const cargoDb = CARGO_MAP[copiloto.cargo] ?? copiloto.cargo.replace(/_/g, ' ');
    const ano = ANO_POR_CARGO[cargoDb] ?? 2022;
    const resolvedUf = uf ?? copiloto.estado.toUpperCase();
    const siglaPartido = partidoOverride ?? extrairSiglaPartido(copiloto.partido);

    const cacheKey = `mapa:filtro:${resolvedUf}:${siglaPartido}:${ideologia ?? ''}:${candidatoNome ?? ''}:${candidatoNumero ?? ''}:${cargoDb}`;
    const memHit = memGet<object>(cacheKey);
    if (memHit) return memHit;
    const redisHit = await redis.get(cacheKey).catch(() => null);
    if (redisHit) {
      const parsed = JSON.parse(redisHit);
      memSet(cacheKey, parsed, CACHE_TTL);
      return parsed;
    }

    // Query votos: ideologia (soma de partidos) > partido específico > padrão do copiloto
    let votosRaw: Array<{ id_municipio_tse: number; votos_partido: number; votos_total: number }>;
    if (ideologia && !partidoOverride) {
      votosRaw = await queryVotosPorIdeologia(resolvedUf, cargoDb, ano, ideologia);
      if (votosRaw.length === 0) votosRaw = await queryVotos(resolvedUf, cargoDb, ano, siglaPartido);
    } else {
      votosRaw = await queryVotos(resolvedUf, cargoDb, ano, siglaPartido);
    }

    const [centroidsRaw, { nomesMap, microMap }] = await Promise.all([
      prisma.$queryRaw<Array<{ id_municipio_tse: number; id_municipio: number | null; lat: number; lng: number }>>`
        SELECT id_municipio_tse, MIN(id_municipio) AS id_municipio,
          AVG(latitude)::float AS lat, AVG(longitude)::float AS lng
        FROM perfis_locais_votacao
        WHERE sigla_uf = ${resolvedUf} AND latitude IS NOT NULL AND longitude IS NOT NULL
        GROUP BY id_municipio_tse
      `,
      fetchNomesMap(resolvedUf),
    ]);

    const centroidsMap = new Map(centroidsRaw.map((c) => [c.id_municipio_tse, c]));
    const sorted = [...votosRaw].sort((a, b) => b.votos_partido - a.votos_partido);
    const rankingMap = new Map(sorted.map((r, i) => [r.id_municipio_tse, i + 1]));
    const totalVotosPartido = sorted.reduce((sum, r) => sum + r.votos_partido, 0);

    const features = votosRaw.map((r) => {
      const c = centroidsMap.get(r.id_municipio_tse);
      if (!c?.lat || !c?.lng) return null;
      const percentual = r.votos_total > 0 ? (r.votos_partido / r.votos_total) * 100 : 0;
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
        properties: {
          municipioTse: r.id_municipio_tse,
          municipioIbge: c.id_municipio ?? null,
          municipioNome: nomesMap.get(r.id_municipio_tse) ?? String(r.id_municipio_tse),
          microRegiaoId: microMap.get(r.id_municipio_tse) ?? null,
          uf: resolvedUf,
          votosPartido: r.votos_partido,
          votosTotal: r.votos_total,
          percentual: Math.round(percentual * 100) / 100,
          ranking: rankingMap.get(r.id_municipio_tse) ?? 0,
          lat: c.lat,
          lng: c.lng,
        },
      };
    }).filter((f): f is NonNullable<typeof f> => f !== null);

    const geojson = {
      type: 'FeatureCollection' as const,
      features,
      metadata: {
        partido: ideologia && !partidoOverride ? ideologia : siglaPartido,
        cargo: cargoDb,
        uf: resolvedUf,
        ano,
        totalMunicipios: features.length,
        totalVotosPartido,
        nomeUrna: ideologia && !partidoOverride ? null : copiloto.nome_urna,
        microrregiao: copiloto.microrregiao,
        macrorregiao: copiloto.macrorregiao,
      },
    };

    memSet(cacheKey, geojson, CACHE_TTL);
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(geojson)).catch(() => null);
    return geojson;
  },

  async getMunicipioDetalhes(
    municipioTse: number,
    uf: string,
    cargoKey: string,
    ano: number,
  ) {
    const cargoDb = CARGO_MAP[cargoKey] ?? cargoKey.replace(/_/g, ' ');
    const query = prisma.$queryRaw<Array<{ sigla_partido: string; votos: number }>>`
      SELECT sigla_partido, SUM(votos)::int AS votos
      FROM mv_votos_municipio
      WHERE id_municipio_tse = ${municipioTse}
        AND sigla_uf = ${uf}
        AND cargo = ${cargoDb}
        AND ano = ${ano}
      GROUP BY sigla_partido
      ORDER BY votos DESC
      LIMIT 10
    `;
    return query.catch(() =>
      prisma.$queryRaw<Array<{ sigla_partido: string; votos: number }>>`
        SELECT sigla_partido, SUM(votos)::int AS votos
        FROM resultados_candidato_secao
        WHERE id_municipio_tse = ${municipioTse}
          AND sigla_uf = ${uf}
          AND cargo = ${cargoDb}
          AND ano = ${ano}
        GROUP BY sigla_partido
        ORDER BY votos DESC
        LIMIT 10
      `,
    );
  },
};
