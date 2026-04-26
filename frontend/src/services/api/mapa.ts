import api from './client';

export const mapaApi = {
  getDados: (candidatoId: string) => api.get(`/mapa/dados?candidato_id=${candidatoId}`),
  getFilteredDados: (
    candidatoId: string,
    params: { estado?: string; partido?: string; ideologia?: string },
  ) =>
    api.get(`/mapa/filtro`, {
      params: {
        candidato_id: candidatoId,
        estado: params.estado || undefined,
        partido: params.partido || undefined,
        ideologia: params.ideologia || undefined,
      },
    }),
  getCamada: (candidatoId: string, nivel: 'macro' | 'micro', params?: Record<string, string | number>) =>
    api.get(`/mapa/camada`, { params: { candidato_id: candidatoId, nivel, ...params } }),
  getCamadaZona: (candidatoId: string, municipioTse: number) =>
    api.get(`/mapa/camada`, { params: { candidato_id: candidatoId, nivel: 'zona', municipio_tse: municipioTse } }),
  getZonaDetalhes: (zonaId: number) => api.get(`/mapa/zona/${zonaId}/detalhes`),
  getComparativo: (candidatoIds: string[]) =>
    api.get(`/mapa/comparativo?candidatos=${candidatoIds.join(',')}`),
};
