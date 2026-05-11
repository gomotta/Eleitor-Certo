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

export async function fetchNomesMap(uf: string): Promise<{ nomesMap: Map<number, string>; microMap: Map<number, number> }> {
  if (nomesPromiseCache.has(uf)) return nomesPromiseCache.get(uf)!;

  // TSE → IBGE id pode estar ausente em uma tabela mas presente em outra; juntamos
  // todas as fontes para maximizar a cobertura de nomes (evitando que a UI mostre
  // o id do município no lugar do nome).
  const promise = Promise.all([
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`),
    prisma.$queryRaw<Array<{ id_municipio_tse: number; id_municipio: number }>>`
      SELECT DISTINCT id_municipio_tse, id_municipio
      FROM perfis_locais_votacao
      WHERE sigla_uf = ${uf} AND id_municipio IS NOT NULL AND id_municipio_tse IS NOT NULL
    `,
    prisma.$queryRaw<Array<{ id_municipio_tse: number; id_municipio: number }>>`
      SELECT DISTINCT id_municipio_tse, id_municipio
      FROM candidatos
      WHERE sigla_uf = ${uf} AND id_municipio IS NOT NULL AND id_municipio_tse IS NOT NULL
    `.catch(() => [] as Array<{ id_municipio_tse: number; id_municipio: number }>),
    prisma.$queryRaw<Array<{ id_municipio_tse: number; id_municipio: number }>>`
      SELECT DISTINCT id_municipio_tse, id_municipio
      FROM resultados_candidato_secao
      WHERE sigla_uf = ${uf} AND id_municipio IS NOT NULL AND id_municipio_tse IS NOT NULL
    `.catch(() => [] as Array<{ id_municipio_tse: number; id_municipio: number }>),
  ]).then(async ([ibgeResp, perfisRows, candidatosRows, resultadosRows]) => {
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
      const apply = (rows: Array<{ id_municipio_tse: number; id_municipio: number }>) => {
        for (const r of rows) {
          if (!nomesMap.has(r.id_municipio_tse)) {
            const nome = ibgeNomeMap.get(r.id_municipio);
            if (nome) nomesMap.set(r.id_municipio_tse, nome);
          }
          if (!microMap.has(r.id_municipio_tse)) {
            const microId = ibgeMicroMap.get(r.id_municipio);
            if (microId) microMap.set(r.id_municipio_tse, microId);
          }
        }
      };
      apply(perfisRows);
      apply(candidatosRows);
      apply(resultadosRows);
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

type VotosMunicipioRow = { id_municipio_tse: number; votos_partido: number; votos_total: number };

async function queryVotos(
  uf: string,
  cargoDb: string,
  ano: number,
  siglaPartido: string,
): Promise<VotosMunicipioRow[]> {
  const mvRows = await (prisma.$queryRaw<VotosMunicipioRow[]>`
    SELECT
      id_municipio_tse,
      SUM(CASE WHEN sigla_partido = ${siglaPartido} THEN votos ELSE 0 END)::int AS votos_partido,
      SUM(votos)::int AS votos_total
    FROM mv_votos_municipio
    WHERE sigla_uf = ${uf} AND cargo = ${cargoDb} AND ano = ${ano}
    GROUP BY id_municipio_tse
  `.catch(() => [] as VotosMunicipioRow[]));
  if (mvRows.some((r) => r.votos_partido > 0)) return mvRows;

  return prisma.$queryRaw<VotosMunicipioRow[]>`
    SELECT
      id_municipio_tse,
      SUM(CASE WHEN sigla_partido = ${siglaPartido} THEN votos ELSE 0 END)::int AS votos_partido,
      SUM(votos)::int AS votos_total
    FROM resultados_candidato_secao
    WHERE sigla_uf = ${uf} AND cargo = ${cargoDb} AND ano = ${ano}
      AND (turno = 1 OR turno IS NULL)
    GROUP BY id_municipio_tse
  `;
}

async function queryVotosPorIdeologia(
  uf: string,
  cargoDb: string,
  ano: number,
  ideologia: string,
): Promise<VotosMunicipioRow[]> {
  const partidosDaIdeologia = await prisma.partidos.findMany({
    where: { ideologia },
    select: { sigla: true },
  });
  if (partidosDaIdeologia.length === 0) return [];
  const siglas = partidosDaIdeologia.map((p) => p.sigla);

  const mvRows = await (prisma.$queryRaw<VotosMunicipioRow[]>`
    SELECT id_municipio_tse,
      SUM(CASE WHEN sigla_partido IN (${Prisma.join(siglas)}) THEN votos ELSE 0 END)::int AS votos_partido,
      SUM(votos)::int AS votos_total
    FROM mv_votos_municipio
    WHERE sigla_uf = ${uf} AND cargo = ${cargoDb} AND ano = ${ano}
    GROUP BY id_municipio_tse
  `.catch(() => [] as VotosMunicipioRow[]));
  if (mvRows.some((r) => r.votos_partido > 0)) return mvRows;

  return prisma.$queryRaw<VotosMunicipioRow[]>`
    SELECT id_municipio_tse,
      SUM(CASE WHEN sigla_partido IN (${Prisma.join(siglas)}) THEN votos ELSE 0 END)::int AS votos_partido,
      SUM(votos)::int AS votos_total
    FROM resultados_candidato_secao
    WHERE sigla_uf = ${uf} AND cargo = ${cargoDb} AND ano = ${ano}
      AND (turno = 1 OR turno IS NULL)
    GROUP BY id_municipio_tse
  `;
}

async function queryVotosCandidato(
  uf: string,
  cargoDb: string,
  ano: number,
  sequencial: string,
): Promise<Array<{ id_municipio_tse: number; votos_partido: number; votos_total: number }>> {
  // Votos do candidato específico + total da eleição por município
  return prisma.$queryRaw`
    SELECT
      r.id_municipio_tse,
      SUM(CASE WHEN r.sequencial_candidato = ${sequencial} THEN r.votos ELSE 0 END)::int AS votos_partido,
      SUM(r.votos)::int AS votos_total
    FROM resultados_candidato_secao r
    WHERE r.sigla_uf = ${uf}
      AND r.cargo = ${cargoDb}
      AND r.ano = ${ano}
      AND (r.turno = 1 OR r.turno IS NULL)
    GROUP BY r.id_municipio_tse
    HAVING SUM(CASE WHEN r.sequencial_candidato = ${sequencial} THEN r.votos ELSE 0 END) > 0
  `;
}

async function queryVotosTodosCargos(
  uf: string,
  ano: number,
  siglaPartido: string,
): Promise<VotosMunicipioRow[]> {
  const mvRows = await (prisma.$queryRaw<VotosMunicipioRow[]>`
    SELECT
      id_municipio_tse,
      SUM(CASE WHEN sigla_partido = ${siglaPartido} THEN votos ELSE 0 END)::int AS votos_partido,
      SUM(votos)::int AS votos_total
    FROM mv_votos_municipio
    WHERE sigla_uf = ${uf} AND ano = ${ano}
    GROUP BY id_municipio_tse
  `.catch(() => [] as VotosMunicipioRow[]));
  if (mvRows.some((r) => r.votos_partido > 0)) return mvRows;

  return prisma.$queryRaw<VotosMunicipioRow[]>`
    SELECT
      id_municipio_tse,
      SUM(CASE WHEN sigla_partido = ${siglaPartido} THEN votos ELSE 0 END)::int AS votos_partido,
      SUM(votos)::int AS votos_total
    FROM resultados_candidato_secao
    WHERE sigla_uf = ${uf} AND ano = ${ano}
      AND (turno = 1 OR turno IS NULL)
    GROUP BY id_municipio_tse
  `;
}

export function invalidarCacheMapaDados(candidatoId: string): void {
  const key = `mapa:v2:${candidatoId}`;
  memCache.delete(key);
  redis.del(key).catch(() => null);
}

export const MapaService = {
  async getDados(candidatoId: string, anoOverride?: number, cargoOverride?: string) {
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
    const ano = anoOverride ?? ANO_POR_CARGO[cargoDb] ?? 2022;
    const uf = copiloto.estado.toUpperCase();

    const cargoFiltro = cargoOverride && cargoOverride !== 'todos' ? cargoOverride : null;
    const cacheKey = `mapa:v5:${candidatoId}:${ano}:${cargoFiltro ?? 'todos'}`;

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

    const [votosRaw, centroidsRaw] = await Promise.all([
      cargoFiltro
        ? queryVotos(uf, cargoFiltro, ano, siglaPartido)
        : queryVotosTodosCargos(uf, ano, siglaPartido),
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
            municipioNome: nomesMap.get(r.id_municipio_tse) ?? 'Município sem identificação',
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
        cargo: cargoFiltro ?? 'todos',
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
    opts: { estado?: string; partido?: string; ideologia?: string; candidatoSequencial?: string; candidatoNomeUrna?: string; cargo?: string; ano?: number },
  ) {
    const uf = (opts.estado?.toUpperCase() || undefined);
    const partidoOverride = opts.partido?.toUpperCase() || undefined;
    const ideologia = opts.ideologia?.trim() || undefined;
    const candidatoSequencial = opts.candidatoSequencial?.trim() || undefined;
    const candidatoNomeUrna = opts.candidatoNomeUrna?.trim() || undefined;
    const cargoFiltro = opts.cargo && opts.cargo !== 'todos' ? opts.cargo : null;

    const copiloto = await prisma.copiloto.findUnique({
      where: { id: candidatoId },
      select: { partido: true, cargo: true, estado: true, microrregiao: true, macrorregiao: true, nome_urna: true },
    });
    if (!copiloto || !copiloto.cargo || !copiloto.estado) {
      throw new AppError('Candidato sem perfil completo', 404);
    }

    const cargoDb = CARGO_MAP[copiloto.cargo] ?? copiloto.cargo.replace(/_/g, ' ');
    const ano = opts.ano ?? ANO_POR_CARGO[cargoDb] ?? 2022;
    const resolvedUf = uf ?? copiloto.estado.toUpperCase();
    const siglaPartido = partidoOverride ?? extrairSiglaPartido(copiloto.partido);

    const cacheKey = `mapa:filtro:v2:${resolvedUf}:${ano}:${siglaPartido}:${ideologia ?? ''}:${candidatoSequencial ?? ''}:${cargoFiltro ?? 'todos'}`;
    const memHit = memGet<object>(cacheKey);
    if (memHit) return memHit;
    const redisHit = await redis.get(cacheKey).catch(() => null);
    if (redisHit) {
      const parsed = JSON.parse(redisHit);
      memSet(cacheKey, parsed, CACHE_TTL);
      return parsed;
    }

    // Query votos: candidato específico > ideologia > partido > padrão do copiloto
    let votosRaw: Array<{ id_municipio_tse: number; votos_partido: number; votos_total: number }>;
    if (candidatoSequencial && cargoFiltro) {
      votosRaw = await queryVotosCandidato(resolvedUf, cargoFiltro, ano, candidatoSequencial);
    } else if (ideologia && !partidoOverride) {
      const cargoParaIdeologia = cargoFiltro ?? cargoDb;
      votosRaw = await queryVotosPorIdeologia(resolvedUf, cargoParaIdeologia, ano, ideologia);
      if (votosRaw.length === 0) {
        votosRaw = cargoFiltro
          ? await queryVotos(resolvedUf, cargoFiltro, ano, siglaPartido)
          : await queryVotosTodosCargos(resolvedUf, ano, siglaPartido);
      }
    } else {
      votosRaw = cargoFiltro
        ? await queryVotos(resolvedUf, cargoFiltro, ano, siglaPartido)
        : await queryVotosTodosCargos(resolvedUf, ano, siglaPartido);
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
          municipioNome: nomesMap.get(r.id_municipio_tse) ?? 'Município sem identificação',
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
        partido: candidatoSequencial
          ? (candidatoNomeUrna ?? siglaPartido)
          : (ideologia && !partidoOverride ? ideologia : siglaPartido),
        cargo: cargoFiltro ?? 'todos',
        uf: resolvedUf,
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

  async getMunicipioDetalhes(
    municipioTse: number,
    uf: string,
    cargoKey: string,
    ano: number,
    nomeLocal?: string,
  ) {
    const isTodos = cargoKey === 'todos';
    const cargoDb = isTodos ? '' : (CARGO_MAP[cargoKey] ?? cargoKey.replace(/_/g, ' '));

    // Quando local é especificado, precisa do JOIN com perfis (mv não tem zona/secao)
    if (nomeLocal) {
      const cargoFilter = isTodos ? Prisma.sql`1=1` : Prisma.sql`r.cargo = ${cargoDb}`;
      return prisma.$queryRaw<Array<{ sigla_partido: string; votos: number }>>`
        SELECT regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g') AS sigla_partido,
               SUM(r.votos)::int AS votos
        FROM resultados_candidato_secao r
        JOIN perfis_locais_votacao p
          ON p.id_municipio_tse = r.id_municipio_tse
          AND p.zona = r.zona
          AND p.secao = r.secao
          AND p.ano = r.ano
          AND p.turno = 1
        WHERE r.id_municipio_tse = ${municipioTse}
          AND r.sigla_uf = ${uf}
          AND ${cargoFilter}
          AND r.ano = ${ano}
          AND (r.turno = 1 OR r.turno IS NULL)
          AND p.nome = ${nomeLocal}
        GROUP BY regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g')
        ORDER BY votos DESC
        LIMIT 10
      `;
    }

    const cargoFilter = isTodos ? Prisma.sql`1=1` : Prisma.sql`cargo = ${cargoDb}`;
    const query = prisma.$queryRaw<Array<{ sigla_partido: string; votos: number }>>`
      SELECT regexp_replace(sigla_partido, '[\x80-\x9f]', '', 'g') AS sigla_partido, SUM(votos)::int AS votos
      FROM mv_votos_municipio
      WHERE id_municipio_tse = ${municipioTse}
        AND sigla_uf = ${uf}
        AND ${cargoFilter}
        AND ano = ${ano}
      GROUP BY regexp_replace(sigla_partido, '[\x80-\x9f]', '', 'g')
      ORDER BY votos DESC
      LIMIT 10
    `;
    return query.catch(() =>
      prisma.$queryRaw<Array<{ sigla_partido: string; votos: number }>>`
        SELECT regexp_replace(sigla_partido, '[\x80-\x9f]', '', 'g') AS sigla_partido, SUM(votos)::int AS votos
        FROM resultados_candidato_secao
        WHERE id_municipio_tse = ${municipioTse}
          AND sigla_uf = ${uf}
          AND ${cargoFilter}
          AND ano = ${ano}
        GROUP BY regexp_replace(sigla_partido, '[\x80-\x9f]', '', 'g')
        ORDER BY votos DESC
        LIMIT 10
      `,
    );
  },

  async getMunicipioCandidatosPorPartido(
    municipioTse: number,
    uf: string,
    cargoKey: string,
    ano: number,
    siglaPartido: string,
  ) {
    const isTodos = cargoKey === 'todos';
    const cargoDb = isTodos ? '' : (CARGO_MAP[cargoKey] ?? cargoKey.replace(/_/g, ' '));
    const cargoFilter = isTodos ? Prisma.sql`1=1` : Prisma.sql`r.cargo = ${cargoDb}`;
    const cargoFilterC = isTodos ? Prisma.sql`1=1` : Prisma.sql`c.cargo = ${cargoDb}`;
    return prisma.$queryRaw<Array<{ sequencial: bigint; numero: number | null; nome_urna: string | null; sigla_partido: string; cargo: string; votos: number }>>`
      SELECT
        c.sequencial,
        c.numero::int AS numero,
        c.nome_urna,
        regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g') AS sigla_partido,
        r.cargo,
        SUM(r.votos)::int AS votos
      FROM resultados_candidato_secao r
      JOIN candidatos c
        ON c.sequencial = r.sequencial_candidato
        AND c.ano = r.ano
        AND c.sigla_uf = r.sigla_uf
        AND c.cargo = r.cargo
      WHERE r.id_municipio_tse = ${municipioTse}
        AND r.sigla_uf = ${uf}
        AND ${cargoFilter}
        AND r.ano = ${ano}
        AND ${cargoFilterC}
        AND c.ano = ${ano}
        AND c.sigla_uf = ${uf}
        AND regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g') = ${siglaPartido}
        AND (r.turno = 1 OR r.turno IS NULL)
      GROUP BY c.sequencial, c.numero, c.nome_urna,
               regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g'), r.cargo
      ORDER BY votos DESC
      LIMIT 15
    `;
  },

  // Candidatos em um município — qualquer cargo, partido e local opcionais
  async getMunicipioCandidatos(
    municipioTse: number,
    uf: string,
    cargoKey: string,
    ano: number,
    partido?: string,
    nomeLocal?: string,
  ) {
    const isTodos = cargoKey === 'todos';
    const cargoDb = isTodos ? '' : (CARGO_MAP[cargoKey] ?? cargoKey.replace(/_/g, ' '));
    const cargoFilter = isTodos ? Prisma.sql`1=1` : Prisma.sql`r.cargo = ${cargoDb}`;
    const cargoFilterC = isTodos ? Prisma.sql`1=1` : Prisma.sql`c.cargo = ${cargoDb}`;
    const partidoFilter = partido
      ? Prisma.sql`AND regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g') = ${partido}`
      : Prisma.sql``;
    const localJoin = nomeLocal
      ? Prisma.sql`JOIN perfis_locais_votacao p ON p.id_municipio_tse = r.id_municipio_tse AND p.zona = r.zona AND p.secao = r.secao AND p.ano = r.ano AND p.turno = 1`
      : Prisma.sql``;
    const localFilter = nomeLocal ? Prisma.sql`AND p.nome = ${nomeLocal}` : Prisma.sql``;
    return prisma.$queryRaw<Array<{ sequencial: bigint; numero: number | null; nome_urna: string | null; sigla_partido: string; cargo: string; votos: number }>>`
      SELECT
        c.sequencial,
        c.numero::int AS numero,
        c.nome_urna,
        regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g') AS sigla_partido,
        r.cargo,
        SUM(r.votos)::int AS votos
      FROM resultados_candidato_secao r
      ${localJoin}
      JOIN candidatos c
        ON c.sequencial = r.sequencial_candidato
        AND c.ano = r.ano
        AND c.sigla_uf = r.sigla_uf
        AND c.cargo = r.cargo
      WHERE r.id_municipio_tse = ${municipioTse}
        AND r.sigla_uf = ${uf}
        AND ${cargoFilter}
        AND r.ano = ${ano}
        AND ${cargoFilterC}
        AND c.ano = ${ano}
        AND c.sigla_uf = ${uf}
        AND (r.turno = 1 OR r.turno IS NULL)
        ${partidoFilter}
        ${localFilter}
      GROUP BY c.sequencial, c.numero, c.nome_urna,
               regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g'), r.cargo
      ORDER BY votos DESC
      LIMIT 30
    `;
  },

  // Busca candidato por nome (para a IA responder votos de um candidato)
  async buscarVotosCandidato(nome: string, uf: string, ano: number, cargoDb?: string, municipioTse?: number) {
    const cargoFilter = cargoDb
      ? Prisma.sql`AND c.cargo = ${cargoDb} AND r.cargo = ${cargoDb}`
      : Prisma.sql``;
    const muniFilter = municipioTse != null
      ? Prisma.sql`AND r.id_municipio_tse = ${municipioTse}`
      : Prisma.sql``;
    return prisma.$queryRaw<Array<{ nome_urna: string; cargo: string; sigla_partido: string; situacao: string | null; total_votos: number }>>`
      SELECT
        c.nome_urna,
        r.cargo,
        regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g') AS sigla_partido,
        c.situacao,
        SUM(r.votos)::int AS total_votos
      FROM resultados_candidato_secao r
      JOIN candidatos c
        ON r.sequencial_candidato = c.sequencial
        AND r.ano = c.ano
        AND c.cargo = r.cargo
      WHERE r.sigla_uf = ${uf}
        AND r.ano = ${ano}
        AND c.ano = ${ano}
        AND (r.turno = 1 OR r.turno IS NULL)
        AND unaccent(c.nome_urna) ILIKE unaccent(${'%' + nome + '%'})
        ${cargoFilter}
        ${muniFilter}
      GROUP BY c.sequencial, c.nome_urna, r.cargo,
               regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g'), c.situacao
      ORDER BY total_votos DESC
      LIMIT 10
    `;
  },

  // ── Ranking: partidos no estado ──────────────────────────────────────────────
  async getRankingPartidos(
    uf: string,
    cargoKey: string,
    ano: number,
    municipios?: number[],
  ) {
    const isTodos = cargoKey === 'todos';
    const cargoDb = isTodos ? '' : (CARGO_MAP[cargoKey] ?? cargoKey.replace(/_/g, ' '));
    const cargoFilter = isTodos ? Prisma.sql`1=1` : Prisma.sql`cargo = ${cargoDb}`;
    const muniFilter = municipios && municipios.length > 0
      ? Prisma.sql`AND id_municipio_tse IN (${Prisma.join(municipios)})`
      : Prisma.sql``;

    const mvRows = await (prisma.$queryRaw<Array<{ sigla_partido: string; votos: number }>>`
      SELECT regexp_replace(sigla_partido, '[\x80-\x9f]', '', 'g') AS sigla_partido,
             SUM(votos)::int AS votos
      FROM mv_votos_municipio
      WHERE sigla_uf = ${uf} AND ${cargoFilter} AND ano = ${ano}
        ${muniFilter}
      GROUP BY regexp_replace(sigla_partido, '[\x80-\x9f]', '', 'g')
      ORDER BY votos DESC
      LIMIT 30
    `.catch(() => [] as Array<{ sigla_partido: string; votos: number }>));
    if (mvRows.length > 0) return mvRows;

    return prisma.$queryRaw<Array<{ sigla_partido: string; votos: number }>>`
      SELECT regexp_replace(sigla_partido, '[\x80-\x9f]', '', 'g') AS sigla_partido,
             SUM(votos)::int AS votos
      FROM resultados_candidato_secao
      WHERE sigla_uf = ${uf} AND ${cargoFilter} AND ano = ${ano}
        AND (turno = 1 OR turno IS NULL)
        ${muniFilter}
      GROUP BY regexp_replace(sigla_partido, '[\x80-\x9f]', '', 'g')
      ORDER BY votos DESC
      LIMIT 30
    `;
  },

  // ── Ranking: candidatos no estado ───────────────────────────────────────────
  async getRankingCandidatos(
    uf: string,
    cargoKey: string,
    ano: number,
    partido?: string,
    municipioTse?: number,
    municipios?: number[],
  ) {
    // Ranking de candidatos requer cargo específico — eleições misturadas não são
    // comparáveis (presidente x governador x senador) e levam a erros de leitura.
    if (cargoKey === 'todos') {
      throw new AppError('Ranking de candidatos requer cargo específico (não "todos").', 400);
    }
    const cargoDb = CARGO_MAP[cargoKey] ?? cargoKey.replace(/_/g, ' ');
    const isMunicipal = cargoDb === 'vereador' || cargoDb === 'prefeito';

    const partidoFilter = partido
      ? Prisma.sql`AND regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g') = ${partido}`
      : Prisma.sql``;
    const municipioFilter = municipioTse != null
      ? Prisma.sql`AND r.id_municipio_tse = ${municipioTse}`
      : Prisma.sql``;
    const municipiosFilter = municipios && municipios.length > 0
      ? Prisma.sql`AND r.id_municipio_tse IN (${Prisma.join(municipios)})`
      : Prisma.sql``;

    // Para cargos municipais (vereador/prefeito) sem filtro de município, restringir
    // a soma de cada candidato ao seu município de origem — cada vereador/prefeito
    // só existe em uma cidade (c.id_municipio_tse). Sem isso, eventuais linhas
    // espúrias do candidato em outros municípios (resíduo de importação) inflariam
    // o total. Aplicado para deputados/senadores/governadores não interfere porque
    // não restringimos lá; aqui é específico ao caso municipal.
    if (isMunicipal && municipioTse == null) {
      // Cada cidade tem seu próprio prefeito/vereador. Agregamos ao nível de
      // (candidato, município de origem), depois pegamos apenas o top 1 por
      // município para o ranking estadual — assim cada cidade contribui com seu
      // próprio campeão, e o ranking não é dominado pelas maiores cidades.
      return prisma.$queryRaw<Array<{
        sequencial: bigint; numero: number | null; nome_urna: string | null;
        sigla_partido: string; cargo: string; votos: number;
      }>>`
        SELECT sequencial, numero, nome_urna, sigla_partido, cargo, votos FROM (
          SELECT
            c.sequencial,
            c.numero::int AS numero,
            c.nome_urna AS nome_urna,
            regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g') AS sigla_partido,
            r.cargo,
            SUM(r.votos)::int AS votos,
            ROW_NUMBER() OVER (
              PARTITION BY c.id_municipio_tse
              ORDER BY SUM(r.votos) DESC
            ) AS rn
          FROM resultados_candidato_secao r
          JOIN candidatos c
            ON c.sequencial = r.sequencial_candidato
            AND c.ano = r.ano
            AND c.sigla_uf = r.sigla_uf
            AND c.cargo = r.cargo
          WHERE r.sigla_uf = ${uf}
            AND r.cargo = ${cargoDb}
            AND r.ano = ${ano}
            AND c.cargo = ${cargoDb}
            AND c.ano = ${ano}
            AND c.sigla_uf = ${uf}
            AND r.id_municipio_tse = c.id_municipio_tse
            AND (r.turno = 1 OR r.turno IS NULL)
            ${partidoFilter}
            ${municipiosFilter}
          GROUP BY c.sequencial, c.numero, c.nome_urna, c.id_municipio_tse,
                   regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g'), r.cargo
        ) t
        WHERE rn = 1
        ORDER BY votos DESC
        LIMIT 50
      `;
    }

    return prisma.$queryRaw<Array<{
      sequencial: bigint; numero: number | null; nome_urna: string | null;
      sigla_partido: string; cargo: string; votos: number;
    }>>`
      SELECT
        c.sequencial,
        c.numero::int AS numero,
        c.nome_urna AS nome_urna,
        regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g') AS sigla_partido,
        r.cargo,
        SUM(r.votos)::int AS votos
      FROM resultados_candidato_secao r
      JOIN candidatos c
        ON c.sequencial = r.sequencial_candidato
        AND c.ano = r.ano
        AND c.sigla_uf = r.sigla_uf
        AND c.cargo = r.cargo
      WHERE r.sigla_uf = ${uf}
        AND r.cargo = ${cargoDb}
        AND r.ano = ${ano}
        AND c.cargo = ${cargoDb}
        AND c.ano = ${ano}
        AND c.sigla_uf = ${uf}
        AND (r.turno = 1 OR r.turno IS NULL)
        ${partidoFilter}
        ${municipioFilter}
        ${municipiosFilter}
      GROUP BY c.sequencial, c.numero, c.nome_urna,
               regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g'), r.cargo
      ORDER BY votos DESC
      LIMIT 50
    `;
  },

  // ── Ranking: cargos no estado (totais por cargo) ────────────────────────────
  async getRankingCargos(uf: string, ano: number, municipios?: number[]) {
    const muniFilter = municipios && municipios.length > 0
      ? Prisma.sql`AND id_municipio_tse IN (${Prisma.join(municipios)})`
      : Prisma.sql``;

    const mvRows = await (prisma.$queryRaw<Array<{ cargo: string; votos: number }>>`
      SELECT cargo, SUM(votos)::int AS votos
      FROM mv_votos_municipio
      WHERE sigla_uf = ${uf} AND ano = ${ano}
        ${muniFilter}
      GROUP BY cargo
      ORDER BY votos DESC
    `.catch(() => [] as Array<{ cargo: string; votos: number }>));
    if (mvRows.length > 0) return mvRows;

    const muniFilterR = municipios && municipios.length > 0
      ? Prisma.sql`AND id_municipio_tse IN (${Prisma.join(municipios)})`
      : Prisma.sql``;
    return prisma.$queryRaw<Array<{ cargo: string; votos: number }>>`
      SELECT cargo, SUM(votos)::int AS votos
      FROM resultados_candidato_secao
      WHERE sigla_uf = ${uf} AND ano = ${ano}
        AND (turno = 1 OR turno IS NULL)
        ${muniFilterR}
      GROUP BY cargo
      ORDER BY votos DESC
    `;
  },

  // ── Ranking: cargos dentro de um local de votação ───────────────────────────
  async getRankingCargosLocal(
    uf: string,
    municipioTse: number,
    ano: number,
    nomeLocal: string,
    opts: { partido?: string; sequencial?: string } = {},
  ) {
    const partidoFilter = opts.partido
      ? Prisma.sql`AND regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g') = ${opts.partido}`
      : Prisma.sql``;
    const seqFilter = opts.sequencial
      ? Prisma.sql`AND r.sequencial_candidato = ${BigInt(opts.sequencial)}`
      : Prisma.sql``;
    return prisma.$queryRaw<Array<{ cargo: string; votos: number }>>`
      SELECT r.cargo, SUM(r.votos)::int AS votos
      FROM resultados_candidato_secao r
      JOIN perfis_locais_votacao p
        ON p.id_municipio_tse = r.id_municipio_tse
        AND p.zona = r.zona
        AND p.secao = r.secao
        AND p.ano = r.ano
        AND p.turno = 1
      WHERE r.id_municipio_tse = ${municipioTse}
        AND r.sigla_uf = ${uf}
        AND r.ano = ${ano}
        AND (r.turno = 1 OR r.turno IS NULL)
        AND p.nome = ${nomeLocal}
        ${partidoFilter}
        ${seqFilter}
      GROUP BY r.cargo
      ORDER BY votos DESC
    `;
  },

  // ── Ranking: locais de votação (prédios) em um município ────────────────────
  // Agrega votos de resultados_candidato_secao pelo nome do local em perfis_locais_votacao
  async getRankingLocais(
    uf: string,
    municipioTse: number,
    cargoKey: string,
    ano: number,
    opts: { partido?: string; sequencial?: string } = {},
  ) {
    const isTodos = cargoKey === 'todos';
    const cargoDb = isTodos ? '' : (CARGO_MAP[cargoKey] ?? cargoKey.replace(/_/g, ' '));
    const cargoFilter = isTodos ? Prisma.sql`1=1` : Prisma.sql`r.cargo = ${cargoDb}`;
    const partidoFilter = opts.partido
      ? Prisma.sql`AND regexp_replace(r.sigla_partido, '[\x80-\x9f]', '', 'g') = ${opts.partido}`
      : Prisma.sql``;

    if (opts.sequencial) {
      return prisma.$queryRaw<Array<{ nome_local: string; votos: number }>>`
        SELECT p.nome AS nome_local, SUM(r.votos)::int AS votos
        FROM resultados_candidato_secao r
        JOIN perfis_locais_votacao p
          ON p.id_municipio_tse = r.id_municipio_tse
          AND p.zona = r.zona
          AND p.secao = r.secao
          AND p.ano = r.ano
          AND p.turno = 1
        WHERE r.id_municipio_tse = ${municipioTse}
          AND r.sigla_uf = ${uf}
          AND ${cargoFilter}
          AND r.ano = ${ano}
          AND r.sequencial_candidato = ${BigInt(opts.sequencial)}
          AND (r.turno = 1 OR r.turno IS NULL)
        GROUP BY p.nome
        ORDER BY votos DESC
        LIMIT 100
      `;
    }

    return prisma.$queryRaw<Array<{ nome_local: string; votos: number }>>`
      SELECT p.nome AS nome_local, SUM(r.votos)::int AS votos
      FROM resultados_candidato_secao r
      JOIN perfis_locais_votacao p
        ON p.id_municipio_tse = r.id_municipio_tse
        AND p.zona = r.zona
        AND p.secao = r.secao
        AND p.ano = r.ano
        AND p.turno = 1
      WHERE r.id_municipio_tse = ${municipioTse}
        AND r.sigla_uf = ${uf}
        AND ${cargoFilter}
        AND r.ano = ${ano}
        AND (r.turno = 1 OR r.turno IS NULL)
        ${partidoFilter}
      GROUP BY p.nome
      ORDER BY votos DESC
      LIMIT 100
    `;
  },

  // ── Votos por município de um partido ou candidato ──────────────────────────
  async getVotosPorMunicipio(
    uf: string, cargoKey: string, ano: number,
    opts: { partido?: string; sequencial?: string },
  ) {
    const isTodos = cargoKey === 'todos';
    const cargoDb = isTodos ? '' : (CARGO_MAP[cargoKey] ?? cargoKey.replace(/_/g, ' '));

    if (opts.sequencial) {
      // Votos de um candidato específico por município
      const cargoFilterR = isTodos ? Prisma.sql`1=1` : Prisma.sql`r.cargo = ${cargoDb}`;
      return prisma.$queryRaw<Array<{ id_municipio_tse: number; votos: number }>>`
        SELECT r.id_municipio_tse, SUM(r.votos)::int AS votos
        FROM resultados_candidato_secao r
        WHERE r.sigla_uf = ${uf}
          AND ${cargoFilterR}
          AND r.ano = ${ano}
          AND r.sequencial_candidato = ${BigInt(opts.sequencial)}
          AND (r.turno = 1 OR r.turno IS NULL)
        GROUP BY r.id_municipio_tse
        ORDER BY votos DESC
      `;
    }

    // Votos por município — opcionalmente filtrado por partido. Sem partido nem
    // sequencial, retorna o total do cargo por município (usado quando o
    // contexto da análise tem cargo específico mas ainda nenhum partido).
    const cargoFilter = isTodos ? Prisma.sql`1=1` : Prisma.sql`cargo = ${cargoDb}`;
    const partidoFilter = opts.partido
      ? Prisma.sql`AND regexp_replace(sigla_partido, '[\x80-\x9f]', '', 'g') = ${opts.partido}`
      : Prisma.sql``;
    const mvRows = await (prisma.$queryRaw<Array<{ id_municipio_tse: number; votos: number }>>`
      SELECT id_municipio_tse, SUM(votos)::int AS votos
      FROM mv_votos_municipio
      WHERE sigla_uf = ${uf} AND ${cargoFilter} AND ano = ${ano}
        ${partidoFilter}
      GROUP BY id_municipio_tse
      ORDER BY votos DESC
    `.catch(() => [] as Array<{ id_municipio_tse: number; votos: number }>));
    if (mvRows.length > 0) return mvRows;

    const cargoFilterR = isTodos ? Prisma.sql`1=1` : Prisma.sql`cargo = ${cargoDb}`;
    return prisma.$queryRaw<Array<{ id_municipio_tse: number; votos: number }>>`
      SELECT id_municipio_tse, SUM(votos)::int AS votos
      FROM resultados_candidato_secao
      WHERE sigla_uf = ${uf} AND ${cargoFilterR} AND ano = ${ano}
        ${partidoFilter}
        AND (turno = 1 OR turno IS NULL)
      GROUP BY id_municipio_tse
      ORDER BY votos DESC
    `;
  },
};
