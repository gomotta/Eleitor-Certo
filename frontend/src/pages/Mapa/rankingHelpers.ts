import type { MunicipioProperties } from './index';

export type TopN = 10 | 20 | 50 | 999;
export type StartLevel = 'macro' | 'micro' | 'municipio';
export type GroupBy = 'regiao' | 'partido' | 'candidato' | 'custom';

export type Dimension = 'partido' | 'macro' | 'micro' | 'municipio' | 'candidato' | 'cargo' | 'local';

export interface DimensionMeta {
  id: Dimension;
  label: string;
  hint: string;
}

export const DIMENSION_DEFS: DimensionMeta[] = [
  { id: 'cargo',      label: 'Cargo',      hint: 'Eleição/cargo'         },
  { id: 'partido',    label: 'Partido',    hint: 'Sigla partidária'       },
  { id: 'macro',      label: 'Macro',      hint: 'Mesorregião'            },
  { id: 'micro',      label: 'Micro',      hint: 'Microrregião'           },
  { id: 'municipio',  label: 'Município',  hint: 'Cidade'                 },
  { id: 'candidato',  label: 'Candidato',  hint: 'Pessoa votada'          },
  { id: 'local',      label: 'Local',      hint: 'Prédio de votação'      },
];

export interface NodeCtx {
  partido?: string;
  macroId?: number;
  microId?: number;
  municipioTse?: number;
  candidatoSeq?: string;
  cargo?: string;
  nomeLocal?: string;
}

export interface CustomNodeRow {
  key: string;
  nome: string;
  sublabel?: string;
  votos: number;
  ctx: Partial<NodeCtx>;
  hasChildren: boolean;
}

export interface MicroInfo { id: number; nome: string; macroId: number; macroNome: string }
export interface GeoRow { id: number; nome: string; votos: number; votosTotal: number; props?: MunicipioProperties }
export interface PartidoRow { sigla_partido: string; votos: number }
export interface CargoRow { cargo: string; votos: number }
export interface CandidatoRow { numero: number | null; nome_urna: string | null; votos: number; sigla_partido?: string; sequencial?: string; cargo?: string }
export interface VotoMuniRow { id_municipio_tse: number; votos: number }
export interface LocalRow { nome_local: string; votos: number }

export function aggregate(
  items: MunicipioProperties[],
  getKey: (m: MunicipioProperties) => number | null,
  getName: (m: MunicipioProperties) => string,
): GeoRow[] {
  const map = new Map<number, GeoRow>();
  for (const m of items) {
    const key = getKey(m);
    if (key == null) continue;
    const e = map.get(key) ?? { id: key, nome: getName(m), votos: 0, votosTotal: 0 };
    e.votos += m.votosPartido;
    e.votosTotal += m.votosTotal;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => b.votos - a.votos);
}

export function aggregateVotosByGeo(
  votosMuni: VotoMuniRow[],
  microMap: Map<number, MicroInfo>,
  nomesMap: Map<number, string>,
  nivel: StartLevel,
): GeoRow[] {
  if (nivel === 'municipio') {
    return votosMuni
      .map((v) => ({ id: v.id_municipio_tse, nome: nomesMap.get(v.id_municipio_tse) ?? 'Município sem identificação', votos: v.votos, votosTotal: 0 }))
      .sort((a, b) => b.votos - a.votos);
  }
  const map = new Map<number, GeoRow>();
  for (const v of votosMuni) {
    const micro = microMap.get(v.id_municipio_tse);
    if (!micro) continue;
    const key = nivel === 'macro' ? micro.macroId : micro.id;
    const nome = nivel === 'macro' ? micro.macroNome : micro.nome;
    const e = map.get(key) ?? { id: key, nome, votos: 0, votosTotal: 0 };
    e.votos += v.votos;
    map.set(key, e);
  }
  return [...map.values()].sort((a, b) => b.votos - a.votos);
}

export function getMuniTseForGeo(
  geoId: number,
  nivel: StartLevel,
  microMap: Map<number, MicroInfo>,
  allMuniTseCodes: number[],
): number[] {
  if (nivel === 'municipio') return [geoId];
  return allMuniTseCodes.filter((tse) => {
    const m = microMap.get(tse);
    if (!m) return false;
    return nivel === 'macro' ? m.macroId === geoId : m.id === geoId;
  });
}
