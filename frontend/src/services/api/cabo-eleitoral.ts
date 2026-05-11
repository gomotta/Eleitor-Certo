import api from './client';

export interface ZonaEleitoral {
  zona: number;
  nome_local: string;
}

export interface LocalVotacao {
  zona: number;
  nome: string;
  bairro: string | null;
}

export interface HistoricoApoio {
  id: string;
  cabo_eleitoral_id: string;
  ano_eleicao: number;
  sequencial_candidato: string;
  candidato_nome: string;
  cargo: string | null;
  id_municipio_tse: number;
  municipio_nome: string | null;
  secoes: ZonaEleitoral[];
  votos_calculados: number;
  criado_em: string;
  atualizado_em: string;
}

export interface CaboEleitoral {
  id: string;
  usuario_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cidade_nome: string | null;
  estado: string | null;
  historicos: HistoricoApoio[];
  criado_em: string;
  atualizado_em: string;
}

export interface CaboEleitoralListResponse {
  cabos: CaboEleitoral[];
  total_votos: number;
}

export interface CandidatoSearch {
  sequencial: string;
  nome: string | null;
  nome_urna: string | null;
  cargo: string | null;
  sigla_partido: string | null;
  sigla_uf: string | null;
  id_municipio: number | null;
  id_municipio_tse: number | null;
  ano: number | null;
}

export interface MunicipioSearch {
  nome: string;
  uf: string;
  id_municipio_tse: number;
}

export interface HistoricoInput {
  ano_eleicao: number;
  sequencial_candidato: string;
  candidato_nome: string;
  cargo?: string;
  id_municipio_tse: number;
  municipio_nome?: string;
  secoes: ZonaEleitoral[];
}

export interface CaboInput {
  nome: string;
  telefone?: string;
  email?: string;
  cidade_nome?: string;
  estado?: string;
  historicos?: HistoricoInput[];
}

export const caboEleitoralApi = {
  create: (data: CaboInput) =>
    api.post<CaboEleitoral>('/cabos-eleitorais', data),

  list: () =>
    api.get<CaboEleitoralListResponse>('/cabos-eleitorais'),

  getById: (id: string) =>
    api.get<CaboEleitoral>(`/cabos-eleitorais/${id}`),

  update: (id: string, data: Partial<Omit<CaboInput, 'historicos'>>) =>
    api.put<CaboEleitoral>(`/cabos-eleitorais/${id}`, data),

  delete: (id: string) =>
    api.delete(`/cabos-eleitorais/${id}`),

  addHistorico: (caboId: string, data: HistoricoInput) =>
    api.post<HistoricoApoio>(`/cabos-eleitorais/${caboId}/historico`, data),

  updateHistorico: (caboId: string, hId: string, data: Partial<HistoricoInput>) =>
    api.put<HistoricoApoio>(`/cabos-eleitorais/${caboId}/historico/${hId}`, data),

  deleteHistorico: (caboId: string, hId: string) =>
    api.delete(`/cabos-eleitorais/${caboId}/historico/${hId}`),

  searchCandidatos: (q: string, ano?: number, municipioTse?: number) =>
    api.get<CandidatoSearch[]>('/cabos-eleitorais/candidatos/search', {
      params: { q, ...(ano ? { ano } : {}), ...(municipioTse ? { municipio_tse: municipioTse } : {}) },
    }),

  searchMunicipios: (q: string, uf?: string) =>
    api.get<MunicipioSearch[]>('/cabos-eleitorais/municipios/search', {
      params: { q, ...(uf ? { uf } : {}) },
    }),

  resolveMunicipio: (tseId: number) =>
    api.get<MunicipioSearch>(`/cabos-eleitorais/municipios/resolve/${tseId}`),

  searchLocaisVotacao: (q: string, municipioTse: number, ano: number) =>
    api.get<LocalVotacao[]>('/cabos-eleitorais/locais/search', {
      params: { q, municipio_tse: municipioTse, ano },
    }),
};
