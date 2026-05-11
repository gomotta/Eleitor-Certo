import prisma from '../database/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';

interface ZonaInput {
  zona: number;
  nome_local: string;
}

interface HistoricoInput {
  ano_eleicao: number;
  sequencial_candidato: string;
  candidato_nome: string;
  cargo?: string;
  id_municipio_tse: number;
  municipio_nome?: string;
  secoes: ZonaInput[];
}

interface CaboInput {
  nome: string;
  telefone?: string;
  email?: string;
  cidade_nome?: string;
  estado?: string;
  historicos?: HistoricoInput[];
}

async function calcularVotos(
  sequencial: string,
  anoEleicao: number,
  idMunicipioTse: number,
  zonas: ZonaInput[],
): Promise<number> {
  if (zonas.length === 0) return 0;

  // Filtra pelas seções específicas de cada local de votação (nome da escola/posto).
  // Usar só o número da zona retornaria TODOS os votos daquela zona inteira,
  // o que numa cidade pequena equivale ao total do candidato.
  const nomesLocais = zonas.map((z) => z.nome_local);

  const result = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COALESCE(SUM(r.votos), 0)::bigint AS total
    FROM resultados_candidato_secao r
    INNER JOIN perfis_locais_votacao p
      ON  p.id_municipio_tse = r.id_municipio_tse
      AND p.ano              = r.ano
      AND p.turno            = r.turno
      AND p.zona             = r.zona
      AND p.secao            = r.secao
    WHERE r.ano               = ${anoEleicao}
      AND r.sequencial_candidato = ${BigInt(sequencial)}
      AND r.turno             = 1
      AND r.id_municipio_tse  = ${idMunicipioTse}
      AND p.nome              = ANY(${nomesLocais})
  `;

  return Number(result[0]?.total ?? 0);
}

export const CaboEleitoralService = {
  async create(usuarioId: string, data: CaboInput) {
    const historicosComVotos = data.historicos
      ? await Promise.all(
          data.historicos.map(async (h) => ({
            ...h,
            votos_calculados: await calcularVotos(
              h.sequencial_candidato,
              h.ano_eleicao,
              h.id_municipio_tse,
              h.secoes,
            ),
          })),
        )
      : [];

    return prisma.cabos_eleitorais.create({
      data: {
        usuario_id: usuarioId,
        nome: data.nome,
        telefone: data.telefone,
        email: data.email,
        cidade_nome: data.cidade_nome,
        estado: data.estado,
        historicos: {
          create: historicosComVotos.map((h) => ({
            ano_eleicao: h.ano_eleicao,
            sequencial_candidato: h.sequencial_candidato,
            candidato_nome: h.candidato_nome,
            cargo: h.cargo,
            id_municipio_tse: h.id_municipio_tse,
            municipio_nome: h.municipio_nome,
            secoes: h.secoes as unknown as Prisma.InputJsonValue,
            votos_calculados: h.votos_calculados,
          })),
        },
      },
      include: { historicos: true },
    });
  },

  async list(usuarioId: string) {
    const cabos = await prisma.cabos_eleitorais.findMany({
      where: { usuario_id: usuarioId },
      include: { historicos: true },
      orderBy: { criado_em: 'desc' },
    });

    const total = cabos.reduce(
      (acc, c) => acc + c.historicos.reduce((s, h) => s + h.votos_calculados, 0),
      0,
    );

    return { cabos, total_votos: total };
  },

  async getById(id: string, usuarioId: string) {
    const cabo = await prisma.cabos_eleitorais.findFirst({
      where: { id, usuario_id: usuarioId },
      include: { historicos: true },
    });
    if (!cabo) throw new AppError('Cabo eleitoral não encontrado', 404);
    return cabo;
  },

  async update(id: string, usuarioId: string, data: Partial<Omit<CaboInput, 'historicos'>>) {
    await CaboEleitoralService.getById(id, usuarioId);
    return prisma.cabos_eleitorais.update({
      where: { id },
      data: {
        nome: data.nome,
        telefone: data.telefone,
        email: data.email,
        cidade_nome: data.cidade_nome,
        estado: data.estado,
        atualizado_em: new Date(),
      },
      include: { historicos: true },
    });
  },

  async delete(id: string, usuarioId: string) {
    await CaboEleitoralService.getById(id, usuarioId);
    await prisma.cabos_eleitorais.delete({ where: { id } });
  },

  async addHistorico(caboId: string, usuarioId: string, data: HistoricoInput) {
    await CaboEleitoralService.getById(caboId, usuarioId);
    const votos = await calcularVotos(
      data.sequencial_candidato,
      data.ano_eleicao,
      data.id_municipio_tse,
      data.secoes,
    );
    return prisma.cabo_eleitoral_historico.create({
      data: {
        cabo_eleitoral_id: caboId,
        ano_eleicao: data.ano_eleicao,
        sequencial_candidato: data.sequencial_candidato,
        candidato_nome: data.candidato_nome,
        cargo: data.cargo,
        id_municipio_tse: data.id_municipio_tse,
        municipio_nome: data.municipio_nome,
        secoes: data.secoes as unknown as Prisma.InputJsonValue,
        votos_calculados: votos,
      },
    });
  },

  async updateHistorico(hId: string, usuarioId: string, data: Partial<HistoricoInput>) {
    const historico = await prisma.cabo_eleitoral_historico.findFirst({
      where: { id: hId },
      include: { cabo_eleitoral: true },
    });
    if (!historico || historico.cabo_eleitoral.usuario_id !== usuarioId) {
      throw new AppError('Histórico não encontrado', 404);
    }

    const zonas = (data.secoes ?? historico.secoes) as ZonaInput[];
    const sequencial = data.sequencial_candidato ?? historico.sequencial_candidato;
    const ano = data.ano_eleicao ?? historico.ano_eleicao;
    const municipio = data.id_municipio_tse ?? historico.id_municipio_tse;
    const votos = await calcularVotos(sequencial, ano, municipio, zonas);

    return prisma.cabo_eleitoral_historico.update({
      where: { id: hId },
      data: {
        ano_eleicao: ano,
        sequencial_candidato: sequencial,
        candidato_nome: data.candidato_nome ?? historico.candidato_nome,
        cargo: data.cargo ?? historico.cargo,
        id_municipio_tse: municipio,
        municipio_nome: data.municipio_nome ?? historico.municipio_nome,
        secoes: zonas as unknown as Prisma.InputJsonValue,
        votos_calculados: votos,
        atualizado_em: new Date(),
      },
    });
  },

  async deleteHistorico(hId: string, usuarioId: string) {
    const historico = await prisma.cabo_eleitoral_historico.findFirst({
      where: { id: hId },
      include: { cabo_eleitoral: true },
    });
    if (!historico || historico.cabo_eleitoral.usuario_id !== usuarioId) {
      throw new AppError('Histórico não encontrado', 404);
    }
    await prisma.cabo_eleitoral_historico.delete({ where: { id: hId } });
  },

  async searchCandidatos(q: string, ano?: number, municipioTse?: number) {
    if (q.trim().length < 2) return [];

    type Row = {
      sequencial: string;
      nome: string | null;
      nome_urna: string | null;
      cargo: string | null;
      sigla_partido: string | null;
      sigla_uf: string | null;
      id_municipio: number | null;
      id_municipio_tse: number | null;
      ano: number | null;
    };

    const like = '%' + q + '%';

    // Mais específico: filtra por município TSE (garante apenas candidatos daquele município)
    if (ano && municipioTse) {
      return prisma.$queryRaw<Row[]>`
        SELECT sequencial::text AS sequencial, nome, nome_urna, cargo,
               sigla_partido, sigla_uf, id_municipio, id_municipio_tse, ano
        FROM candidatos
        WHERE ano = ${ano}
          AND id_municipio_tse = ${municipioTse}
          AND (nome_urna ILIKE ${like} OR nome ILIKE ${like})
        ORDER BY nome_urna
        LIMIT 20
      `;
    }
    if (municipioTse) {
      return prisma.$queryRaw<Row[]>`
        SELECT sequencial::text AS sequencial, nome, nome_urna, cargo,
               sigla_partido, sigla_uf, id_municipio, id_municipio_tse, ano
        FROM candidatos
        WHERE id_municipio_tse = ${municipioTse}
          AND (nome_urna ILIKE ${like} OR nome ILIKE ${like})
        ORDER BY nome_urna, ano DESC
        LIMIT 20
      `;
    }
    if (ano) {
      return prisma.$queryRaw<Row[]>`
        SELECT sequencial::text AS sequencial, nome, nome_urna, cargo,
               sigla_partido, sigla_uf, id_municipio, id_municipio_tse, ano
        FROM candidatos
        WHERE ano = ${ano}
          AND (nome_urna ILIKE ${like} OR nome ILIKE ${like})
        ORDER BY nome_urna
        LIMIT 20
      `;
    }
    return prisma.$queryRaw<Row[]>`
      SELECT sequencial::text AS sequencial, nome, nome_urna, cargo,
             sigla_partido, sigla_uf, id_municipio, id_municipio_tse, ano
      FROM candidatos
      WHERE nome_urna ILIKE ${like} OR nome ILIKE ${like}
      ORDER BY nome_urna
      LIMIT 20
    `;
  },

  async searchLocaisVotacao(q: string, idMunicipioTse: number, anoEleicao: number) {
    if (q.trim().length < 2) return [];

    type Row = { zona: number; nome: string; bairro: string | null };
    return prisma.$queryRaw<Row[]>`
      SELECT DISTINCT ON (zona, nome) zona, nome, bairro
      FROM perfis_locais_votacao
      WHERE id_municipio_tse = ${idMunicipioTse}
        AND ano = ${anoEleicao}
        AND turno = 1
        AND nome ILIKE ${'%' + q + '%'}
      ORDER BY zona, nome
      LIMIT 20
    `;
  },

  async searchMunicipios(q: string, uf?: string) {
    if (q.length < 2) return [];

    const url = uf
      ? `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf.toUpperCase()}/municipios`
      : `https://servicodados.ibge.gov.br/api/v1/localidades/municipios`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = (await res.json()) as Array<{ id: number; nome: string }>;

    const termo = q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const filtered = data
      .filter((m) => m.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(termo))
      .slice(0, 15);

    if (filtered.length === 0) return [];

    const ibgeIds = filtered.map((m) => m.id);
    const tseRows = uf
      ? await prisma.$queryRaw<{ id_municipio: number; id_municipio_tse: number; sigla_uf: string }[]>`
          SELECT DISTINCT ON (id_municipio) id_municipio, id_municipio_tse, sigla_uf
          FROM candidatos
          WHERE id_municipio = ANY(${ibgeIds}::int[])
            AND sigla_uf = ${uf.toUpperCase()}
          LIMIT 50
        `
      : await prisma.$queryRaw<{ id_municipio: number; id_municipio_tse: number; sigla_uf: string }[]>`
          SELECT DISTINCT ON (id_municipio) id_municipio, id_municipio_tse, sigla_uf
          FROM candidatos
          WHERE id_municipio = ANY(${ibgeIds}::int[])
          LIMIT 50
        `;

    const tseMap = new Map(tseRows.map((r) => [r.id_municipio, { id_municipio_tse: r.id_municipio_tse, sigla_uf: r.sigla_uf }]));

    return filtered
      .map((m) => {
        const tse = tseMap.get(m.id);
        if (!tse) return null;
        return { nome: m.nome, uf: tse.sigla_uf, id_municipio_tse: tse.id_municipio_tse };
      })
      .filter(Boolean);
  },

  async resolveMunicipioPorTse(idMunicipioTse: number) {
    const row = await prisma.candidatos.findFirst({
      where: { id_municipio_tse: idMunicipioTse },
      select: { id_municipio: true, sigla_uf: true },
    });
    if (!row?.id_municipio) return null;

    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${row.id_municipio}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { nome: string };
    return { nome: data.nome, uf: row.sigla_uf, id_municipio_tse: idMunicipioTse };
  },
};
