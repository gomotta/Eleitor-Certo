import api from './client';

export const mapaApi = {
  getDados: (candidatoId: string, ano?: number, cargo?: string) =>
    api.get(`/mapa/dados`, {
      params: {
        candidato_id: candidatoId,
        ...(ano ? { ano } : {}),
        ...(cargo ? { cargo } : {}),
      },
    }),
  getFilteredDados: (
    candidatoId: string,
    params: { estado?: string; partido?: string; ideologia?: string; candidatoSequencial?: string; candidatoNomeUrna?: string; cargo?: string },
  ) =>
    api.get(`/mapa/filtro`, {
      params: {
        candidato_id: candidatoId,
        estado: params.estado || undefined,
        partido: params.partido || undefined,
        ideologia: params.ideologia || undefined,
        candidato_sequencial: params.candidatoSequencial || undefined,
        candidato_nome_urna: params.candidatoNomeUrna || undefined,
        cargo: params.cargo || undefined,
      },
    }),
  getCamada: (candidatoId: string, nivel: 'macro' | 'micro', params?: Record<string, string | number>) =>
    api.get(`/mapa/camada`, { params: { candidato_id: candidatoId, nivel, ...params } }),
  getCamadaZona: (candidatoId: string, municipioTse: number) =>
    api.get(`/mapa/camada`, { params: { candidato_id: candidatoId, nivel: 'zona', municipio_tse: municipioTse } }),
  getMunicipioDetalhes: (municipioTse: number, params: { uf: string; cargo: string; ano: number }) =>
    api.get(`/mapa/municipio/${municipioTse}/detalhes`, { params }),
  getMunicipioCandidatosPorPartido: (
    municipioTse: number,
    siglaPartido: string,
    params: { uf: string; cargo: string; ano: number },
  ) => api.get(`/mapa/municipio/${municipioTse}/partido/${siglaPartido}/candidatos`, { params }),
  getZonaDetalhes: (zonaId: number) => api.get(`/mapa/zona/${zonaId}/detalhes`),
  getComparativo: (candidatoIds: string[]) =>
    api.get(`/mapa/comparativo?candidatos=${candidatoIds.join(',')}`),
  getRankingPartidos: (params: { uf: string; cargo: string; ano: number; municipios?: number[] }) =>
    api.get(`/mapa/ranking/partidos`, {
      params: {
        uf: params.uf,
        cargo: params.cargo,
        ano: params.ano,
        municipios: params.municipios && params.municipios.length > 0 ? params.municipios.join(',') : undefined,
      },
    }),
  getRankingCandidatos: (params: { uf: string; cargo: string; ano: number; partido?: string; municipioTse?: number; municipios?: number[] }) =>
    api.get(`/mapa/ranking/candidatos`, {
      params: {
        uf: params.uf,
        cargo: params.cargo,
        ano: params.ano,
        partido: params.partido,
        municipio_tse: params.municipioTse,
        municipios: params.municipios && params.municipios.length > 0 ? params.municipios.join(',') : undefined,
      },
    }),
  getVotosPorMunicipio: (params: { uf: string; cargo: string; ano: number; partido?: string; sequencial?: string }) =>
    api.get(`/mapa/ranking/votos-municipio`, { params }),
};
