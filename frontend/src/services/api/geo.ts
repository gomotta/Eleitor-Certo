import api from './client';

export interface Estado { sigla: string; nome: string; ibgeCode: number }
export interface Cidade { id: number; nome: string; ibgeCode: number }
export interface MacroRegiao { id: number; nome: string; ibgeCode: number }
export interface MicroRegiao { id: number; nome: string; ibgeCode: number }
export interface Partido { sigla: string; nome: string; numero: number | null; ideologia: string }

export const geoApi = {
  getEstados: () => api.get<Estado[]>('/geo/estados'),
  getCidades: (uf: string) => api.get<Cidade[]>(`/geo/cidades?uf=${uf}`),
  getMacroRegioes: (uf: string) => api.get<MacroRegiao[]>(`/geo/macro-regioes?uf=${uf}`),
  getMicroRegioes: (macroId: number) => api.get<MicroRegiao[]>(`/geo/micro-regioes?macro=${macroId}`),
  getPartidos: () => api.get<Partido[]>('/geo/partidos'),
};
