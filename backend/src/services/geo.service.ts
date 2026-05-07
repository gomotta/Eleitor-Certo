import prisma from '../database/prisma';

// Remove acentos e normaliza para uppercase — espelha immutable_unaccent(upper(...)) do banco
function immutableUnaccent(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

// Estados fixos — banco não tem tabela de estados/cidades separadas
const ESTADOS = [
  { sigla: 'AC', nome: 'Acre' }, { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AM', nome: 'Amazonas' }, { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'BA', nome: 'Bahia' }, { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' }, { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' }, { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MG', nome: 'Minas Gerais' }, { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MT', nome: 'Mato Grosso' }, { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' }, { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' }, { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' }, { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RO', nome: 'Rondônia' }, { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' }, { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SE', nome: 'Sergipe' }, { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'TO', nome: 'Tocantins' },
];

export const GeoService = {
  getEstados: () => Promise.resolve(ESTADOS),

  getCidades: async (uf: string) => {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf.toUpperCase()}/municipios`,
    );
    if (!res.ok) return [] as Array<{ id: number; nome: string }>;
    const data = (await res.json()) as Array<{ id: number; nome: string }>;
    return data
      .map((m) => ({ id: m.id, nome: m.nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  },

  getMacroRegioes: async (uf: string) => {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf.toUpperCase()}/mesorregioes`,
    );
    if (!res.ok) return [] as Array<{ id: number; nome: string }>;
    const data = (await res.json()) as Array<{ id: number; nome: string }>;
    return data.map((m) => ({ id: m.id, nome: m.nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  },

  getMicroRegioes: async (macroId: number) => {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/mesorregioes/${macroId}/microrregioes`,
    );
    if (!res.ok) return [] as Array<{ id: number; nome: string }>;
    const data = (await res.json()) as Array<{ id: number; nome: string }>;
    return data.map((m) => ({ id: m.id, nome: m.nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  },

  getPartidos: () =>
    prisma.partidos.findMany({ orderBy: { sigla: 'asc' } }),

  searchCandidatos: async (uf: string, cargoDb: string, ano: number, siglaPartido: string | undefined, q: string) => {
    const termo = immutableUnaccent(q.trim());
    if (siglaPartido) {
      return prisma.$queryRaw<Array<{ sequencial: string; nome_urna: string; numero: number | null }>>`
        SELECT sequencial::text AS sequencial, nome_urna, numero::int AS numero
        FROM candidatos
        WHERE sigla_uf     = ${uf.toUpperCase()}
          AND cargo        = ${cargoDb}
          AND ano          = ${ano}
          AND sigla_partido = ${siglaPartido.toUpperCase()}
          AND immutable_unaccent(upper(nome_urna)) % ${termo}
        ORDER BY similarity(immutable_unaccent(upper(nome_urna)), ${termo}) DESC, nome_urna
        LIMIT 15
      `;
    }
    return prisma.$queryRaw<Array<{ sequencial: string; nome_urna: string; numero: number | null; sigla_partido: string }>>`
      SELECT sequencial::text AS sequencial, nome_urna, numero::int AS numero, sigla_partido
      FROM candidatos
      WHERE sigla_uf = ${uf.toUpperCase()}
        AND cargo    = ${cargoDb}
        AND ano      = ${ano}
        AND immutable_unaccent(upper(nome_urna)) % ${termo}
      ORDER BY similarity(immutable_unaccent(upper(nome_urna)), ${termo}) DESC, nome_urna
      LIMIT 15
    `;
  },
};
