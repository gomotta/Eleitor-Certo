import { useCallback, useEffect, useMemo, useState } from 'react';
import { mapaApi } from '@/services/api/mapa';
import type { MapData, MunicipioProperties } from './index';
import type { GeoTarget } from './MapFilterPanel';
import {
  type TopN, type MicroInfo, type GeoRow, type PartidoRow, type CandidatoRow, type CargoRow, type VotoMuniRow,
  type LocalRow,
  type Dimension, type NodeCtx, type CustomNodeRow,
  aggregate, aggregateVotosByGeo, getMuniTseForGeo,
} from './rankingHelpers';
import AnalysisBuilder from './AnalysisBuilder';

// ── Helpers ──────────────────────────────────────────────────────────────────

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors ${
        active
          ? 'bg-primary-600 text-white border-primary-600'
          : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
      }`}
    >
      {children}
    </button>
  );
}

const ChevronRight = () => (
  <span className="w-3 h-3 shrink-0 flex items-center justify-center text-[11px] font-bold text-gray-400 leading-none">+</span>
);
const ChevronDown = () => (
  <span className="w-3 h-3 shrink-0 flex items-center justify-center text-[11px] font-bold text-primary-500 leading-none">−</span>
);

function MiniBar({ votos, max }: { votos: number; max: number }) {
  const pct = max > 0 ? (votos / max) * 100 : 0;
  return (
    <div className="h-1 bg-gray-100 rounded-full overflow-hidden flex-1 min-w-[32px]">
      <div className="h-full bg-primary-400 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

function LoadingRow({ depth }: { depth: number }) {
  return (
    <div className="flex items-center gap-2 py-2 text-xs text-gray-400" style={{ paddingLeft: `${16 + depth * 16}px` }}>
      <div className="w-3 h-3 border-2 border-primary-300 border-t-transparent rounded-full animate-spin shrink-0" />
      Carregando…
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MapRightTable({
  mapData, open, onClose, geoFilter,
}: {
  mapData: MapData | null;
  open: boolean;
  onClose: () => void;
  geoFilter?: GeoTarget;
}) {
  const [topN, setTopN] = useState<TopN>(20);
  const [microMap, setMicroMap] = useState<Map<number, MicroInfo>>(new Map());
  const [nomesMap, setNomesMap] = useState<Map<number, string>>(new Map());
  const [ibgeLoading, setIbgeLoading] = useState(false);

  // Custom analysis (drag-and-drop drilldown)
  const [customDims,     setCustomDims]     = useState<Dimension[]>([]);
  const [customExpanded, setCustomExpanded] = useState<Set<string>>(new Set());
  const [customCache,    setCustomCache]    = useState<Map<string, CustomNodeRow[]>>(new Map());
  const [customLoading,  setCustomLoading]  = useState<Set<string>>(new Set());

  // ── IBGE fetch & Nomes Map ──
  useEffect(() => {
    if (mapData?.features) {
      const nMap = new Map<number, string>();
      for (const f of mapData.features) {
        nMap.set(f.properties.municipioTse, f.properties.municipioNome);
      }
      setNomesMap(nMap);
    }

    const uf = mapData?.metadata.uf;
    if (!uf) return;
    setIbgeLoading(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/microrregioes`)
      .then((r) => r.json())
      .then((microData: any[]) => {
        const mMap = new Map<number, MicroInfo>();
        for (const m of microData) mMap.set(m.id, { id: m.id, nome: m.nome, macroId: m.mesorregiao.id, macroNome: m.mesorregiao.nome });
        setMicroMap(mMap);
      })
      .catch(() => {})
      .finally(() => setIbgeLoading(false));
  }, [mapData]);

  // ── Reset on data/filter change ──
  useEffect(() => {
    setCustomExpanded(new Set()); setCustomCache(new Map()); setCustomLoading(new Set());
  }, [
    geoFilter?.municipioTse, geoFilter?.microId, geoFilter?.macroId,
    mapData?.metadata.partido, mapData?.metadata.uf, mapData?.metadata.ano, mapData?.metadata.cargo,
  ]);

  // ── Reset custom drilldown state when dims change ──
  useEffect(() => {
    setCustomExpanded(new Set()); setCustomCache(new Map()); setCustomLoading(new Set());
  }, [customDims]);

  // ── Filtered municipalities ──
  const filteredMunicipios = useMemo(() => {
    if (!mapData) return [];
    const all = mapData.features.map((f) => f.properties);
    if (!geoFilter) return all;
    if (geoFilter.type === 'cidade' && geoFilter.municipioTse)
      return all.filter((m) => m.municipioTse === geoFilter.municipioTse);
    if (geoFilter.type === 'micro' && geoFilter.microId) {
      const r = all.filter((m) => m.microRegiaoId === geoFilter.microId);
      return r.length > 0 ? r : all;
    }
    if (geoFilter.type === 'macro' && geoFilter.microIds?.length) {
      const set = new Set(geoFilter.microIds);
      const r = all.filter((m) => (m.microRegiaoId ? set.has(m.microRegiaoId) : false));
      return r.length > 0 ? r : all;
    }
    return all;
  }, [mapData, geoFilter]);

  // ── Build TSE→MicroInfo map keyed by TSE code for aggregation ──
  const tseMicroMap = useMemo(() => {
    if (!mapData) return new Map<number, MicroInfo>();
    const m = new Map<number, MicroInfo>();
    for (const f of mapData.features) {
      const microId = f.properties.microRegiaoId;
      if (microId && microMap.has(microId)) m.set(f.properties.municipioTse, microMap.get(microId)!);
    }
    return m;
  }, [mapData, microMap]);

  // ── Generic row container ──
  function rowBase(depth: number, expanded: boolean, onClick: () => void, children: React.ReactNode, drillable = true) {
    const pl = 16 + depth * 16;
    const bg = expanded ? 'bg-primary-50/60' : depth === 0 ? 'hover:bg-gray-50' : 'hover:bg-primary-50/40';
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left flex items-center gap-2 border-b border-gray-50 transition-colors ${bg} ${drillable ? 'cursor-pointer' : 'cursor-default'}`}
        style={{ paddingLeft: pl, paddingRight: 12, paddingTop: depth === 0 ? 10 : 7, paddingBottom: depth === 0 ? 10 : 7 }}
      >
        {children}
        {drillable && (expanded ? <ChevronDown /> : <ChevronRight />)}
      </button>
    );
  }

  // ── Custom analysis: data loader ────────────────────────────────────────────

  const ctxKey = (ctx: Partial<NodeCtx>): string => {
    const parts: string[] = [];
    if (ctx.partido)              parts.push(`p:${ctx.partido}`);
    if (ctx.macroId != null)      parts.push(`ma:${ctx.macroId}`);
    if (ctx.microId != null)      parts.push(`mi:${ctx.microId}`);
    if (ctx.municipioTse != null) parts.push(`mu:${ctx.municipioTse}`);
    if (ctx.candidatoSeq)         parts.push(`c:${ctx.candidatoSeq}`);
    if (ctx.nomeLocal)            parts.push(`lo:${ctx.nomeLocal}`);
    return parts.join('|');
  };

  const nodeKey = (parentCtx: Partial<NodeCtx>, dim: Dimension, idValue: string | number) =>
    `${ctxKey(parentCtx)}>>${dim}:${idValue}`;

  const filterMunisByCtx = useCallback((ctx: Partial<NodeCtx>): MunicipioProperties[] => {
    return filteredMunicipios.filter((m) => {
      if (ctx.municipioTse != null && m.municipioTse !== ctx.municipioTse) return false;
      if (ctx.microId != null && m.microRegiaoId !== ctx.microId) return false;
      if (ctx.macroId != null) {
        const macroId = microMap.get(m.microRegiaoId ?? 0)?.macroId;
        if (macroId !== ctx.macroId) return false;
      }
      return true;
    });
  }, [filteredMunicipios, microMap]);

  const filterVotosByCtx = useCallback((rows: VotoMuniRow[], ctx: Partial<NodeCtx>): VotoMuniRow[] => {
    return rows.filter((v) => {
      if (ctx.municipioTse != null && v.id_municipio_tse !== ctx.municipioTse) return false;
      const micro = tseMicroMap.get(v.id_municipio_tse);
      if (ctx.microId != null && micro?.id !== ctx.microId) return false;
      if (ctx.macroId != null && micro?.macroId !== ctx.macroId) return false;
      return true;
    });
  }, [tseMicroMap]);

  const loadCustomChildren = useCallback(async (
    parentCtx: Partial<NodeCtx>,
    dim: Dimension,
    hasNext: boolean,
  ): Promise<CustomNodeRow[]> => {
    if (!mapData) return [];
    const { uf, ano } = mapData.metadata;
    const cargo = parentCtx.cargo ?? mapData.metadata.cargo;
    const hasCargoOverride = parentCtx.cargo != null && parentCtx.cargo !== mapData.metadata.cargo;

    // Municípios da região filtrada pelo painel — usado para escopar rankings
    // quando não há geo especificada no contexto do nó pai.
    const geoMuniList: number[] | undefined =
      filteredMunicipios.length < mapData.features.length && filteredMunicipios.length > 0
        ? filteredMunicipios.map((m) => m.municipioTse)
        : undefined;

    // ── Cargo dimension ──
    if (dim === 'cargo') {
      // Quando há um local no contexto, filtra os cargos por esse local de votação
      if (parentCtx.nomeLocal != null && parentCtx.municipioTse != null) {
        const r = await mapaApi.getRankingCargosLocal({
          uf,
          municipioTse: parentCtx.municipioTse,
          ano,
          nomeLocal: parentCtx.nomeLocal,
          partido: parentCtx.partido,
          sequencial: parentCtx.candidatoSeq,
        });
        return (r.data as CargoRow[]).map((c) => ({
          key: nodeKey(parentCtx, dim, c.cargo),
          nome: c.cargo.charAt(0).toUpperCase() + c.cargo.slice(1),
          votos: Number(c.votos),
          ctx: { ...parentCtx, cargo: c.cargo },
          hasChildren: hasNext,
        }));
      }
      // Lista somente faz sentido na raiz (sem filtros de partido/candidato/geo
      // que poderiam vir de um cargo já selecionado mais acima).
      const muniListCtx: number[] | undefined =
        parentCtx.microId != null
          ? getMuniTseForGeo(parentCtx.microId, 'micro', tseMicroMap, mapData.features.map((f) => f.properties.municipioTse))
          : parentCtx.macroId != null
            ? getMuniTseForGeo(parentCtx.macroId, 'macro', tseMicroMap, mapData.features.map((f) => f.properties.municipioTse))
            : parentCtx.municipioTse != null
              ? [parentCtx.municipioTse]
              : geoMuniList;
      const r = await mapaApi.getRankingCargos({ uf, ano, municipios: muniListCtx });
      return (r.data as CargoRow[]).map((c) => ({
        key: nodeKey(parentCtx, dim, c.cargo),
        nome: c.cargo.charAt(0).toUpperCase() + c.cargo.slice(1),
        votos: Number(c.votos),
        ctx: { ...parentCtx, cargo: c.cargo },
        hasChildren: hasNext,
      }));
    }

    // ── Geo dimensions ──
    if (dim === 'macro' || dim === 'micro' || dim === 'municipio') {
      let votos: VotoMuniRow[] | null = null;
      if (parentCtx.partido) {
        const r = await mapaApi.getVotosPorMunicipio({ uf, cargo, ano, partido: parentCtx.partido });
        votos = r.data as VotoMuniRow[];
      } else if (parentCtx.candidatoSeq) {
        const r = await mapaApi.getVotosPorMunicipio({ uf, cargo, ano, sequencial: parentCtx.candidatoSeq });
        votos = r.data as VotoMuniRow[];
      } else if (hasCargoOverride) {
        // Sem partido/candidato, mas com cargo específico vindo do contexto: precisamos
        // dos totais do cargo por município (mapData carregou 'todos os cargos').
        const r = await mapaApi.getVotosPorMunicipio({ uf, cargo, ano });
        votos = r.data as VotoMuniRow[];
      }

      if (votos) {
        const filtered = filterVotosByCtx(votos, parentCtx);
        const rows = aggregateVotosByGeo(filtered, tseMicroMap, nomesMap, dim);
        return rows.map((g) => {
          const ctx: Partial<NodeCtx> = { ...parentCtx };
          if (dim === 'macro')      ctx.macroId      = g.id;
          if (dim === 'micro')      ctx.microId      = g.id;
          if (dim === 'municipio')  ctx.municipioTse = g.id;
          return { key: nodeKey(parentCtx, dim, g.id), nome: g.nome, votos: g.votos, ctx, hasChildren: hasNext };
        });
      }

      const munis = filterMunisByCtx(parentCtx);
      let rows: GeoRow[];
      if (dim === 'macro') {
        rows = aggregate(munis,
          (m) => microMap.get(m.microRegiaoId ?? 0)?.macroId ?? null,
          (m) => microMap.get(m.microRegiaoId ?? 0)?.macroNome ?? '—');
      } else if (dim === 'micro') {
        rows = aggregate(munis,
          (m) => m.microRegiaoId,
          (m) => microMap.get(m.microRegiaoId ?? 0)?.nome ?? `Micro ${m.microRegiaoId}`);
      } else {
        rows = munis
          .map((m) => ({ id: m.municipioTse, nome: m.municipioNome, votos: m.votosPartido, votosTotal: m.votosTotal, props: m }))
          .sort((a, b) => b.votos - a.votos);
      }
      // Quando há drilldown (filhos), exibir o total do cargo na unidade geográfica
      // em vez dos votos só do partido — assim a soma dos filhos (todos os partidos
      // / todos os candidatos da cidade) bate com o valor mostrado no nó pai.
      const useTotal = hasNext;
      const mapped = rows.map((g) => {
        const ctx: Partial<NodeCtx> = { ...parentCtx };
        if (dim === 'macro')      ctx.macroId      = g.id;
        if (dim === 'micro')      ctx.microId      = g.id;
        if (dim === 'municipio')  ctx.municipioTse = g.id;
        const votos = useTotal ? g.votosTotal : g.votos;
        return { key: nodeKey(parentCtx, dim, g.id), nome: g.nome, votos, ctx, hasChildren: hasNext };
      });
      mapped.sort((a, b) => b.votos - a.votos);
      return mapped;
    }

    // Lista de municípios cobertos pelo macro/micro do contexto pai (para escopar
    // rankings agregados quando estamos abaixo de macro/micro).
    const allMuniTseCodes = mapData.features.map((f) => f.properties.municipioTse);
    const muniListForCtx: number[] | undefined =
      parentCtx.microId != null
        ? getMuniTseForGeo(parentCtx.microId, 'micro', tseMicroMap, allMuniTseCodes)
        : parentCtx.macroId != null
          ? getMuniTseForGeo(parentCtx.macroId, 'macro', tseMicroMap, allMuniTseCodes)
          : geoMuniList;

    // ── Local de votação dimension ──
    if (dim === 'local') {
      // Local só tem sentido dentro de um município específico
      if (parentCtx.municipioTse == null) return [];
      const r = await mapaApi.getRankingLocais({
        uf,
        municipioTse: parentCtx.municipioTse,
        cargo,
        ano,
        partido: parentCtx.partido,
        sequencial: parentCtx.candidatoSeq,
      });
      return (r.data as LocalRow[]).map((l) => ({
        key: nodeKey(parentCtx, dim, l.nome_local),
        nome: l.nome_local,
        votos: Number(l.votos),
        ctx: { ...parentCtx, nomeLocal: l.nome_local },
        hasChildren: hasNext,
      }));
    }

    // ── Partido dimension ──
    if (dim === 'partido') {
      if (parentCtx.municipioTse != null) {
        const r = await mapaApi.getMunicipioDetalhes(parentCtx.municipioTse, {
          uf, cargo, ano, nomeLocal: parentCtx.nomeLocal,
        });
        return (r.data as PartidoRow[]).map((p) => ({
          key: nodeKey(parentCtx, dim, p.sigla_partido),
          nome: p.sigla_partido,
          votos: Number(p.votos),
          ctx: { ...parentCtx, partido: p.sigla_partido },
          hasChildren: hasNext,
        }));
      }
      if (parentCtx.candidatoSeq) return [];
      const r = await mapaApi.getRankingPartidos({ uf, cargo, ano, municipios: muniListForCtx });
      return (r.data as PartidoRow[]).map((p) => ({
        key: nodeKey(parentCtx, dim, p.sigla_partido),
        nome: p.sigla_partido,
        votos: Number(p.votos),
        ctx: { ...parentCtx, partido: p.sigla_partido },
        hasChildren: hasNext,
      }));
    }

    // ── Candidato dimension ──
    if (dim === 'candidato') {
      const cargoIsTodos = cargo === 'todos';

      // Município específico no contexto: usa endpoint dedicado que suporta qualquer cargo
      if (parentCtx.municipioTse != null) {
        const r = await mapaApi.getMunicipioCandidatos({
          municipioTse: parentCtx.municipioTse,
          uf, cargo, ano,
          partido: parentCtx.partido,
          nomeLocal: parentCtx.nomeLocal,
        });
        return (r.data as CandidatoRow[]).map((c, i) => {
          const sublabelParts: string[] = [];
          if (c.numero != null) sublabelParts.push(String(c.numero));
          if (c.sigla_partido) sublabelParts.push(c.sigla_partido);
          // Sempre mostrar o cargo para evitar confusão entre cargos diferentes
          if (c.cargo) sublabelParts.push(c.cargo);
          return {
            key: nodeKey(parentCtx, dim, c.sequencial ?? `${c.numero}-${i}`),
            nome: c.nome_urna ?? '—',
            sublabel: sublabelParts.length > 0 ? sublabelParts.join(' · ') : undefined,
            votos: Number(c.votos),
            // Herda o cargo real do candidato no ctx para manter filtro correto em drill-downs subsequentes
            ctx: { ...parentCtx, candidatoSeq: c.sequencial, cargo: c.cargo ?? cargo, partido: parentCtx.partido ?? c.sigla_partido },
            hasChildren: hasNext,
          };
        });
      }

      // Sem município: cargo específico obrigatório (getRankingCandidatos lança para 'todos')
      // Quando cargo vem do contexto (dim 'cargo' anterior), já está em parentCtx.cargo
      if (cargoIsTodos && parentCtx.cargo == null) {
        return [];
      }

      const r = await mapaApi.getRankingCandidatos({
        uf, cargo, ano,
        partido: parentCtx.partido,
        municipios: muniListForCtx,
      });
      return (r.data as CandidatoRow[]).map((c, i) => {
        const sublabelParts: string[] = [];
        if (c.numero != null) sublabelParts.push(String(c.numero));
        if (c.sigla_partido) sublabelParts.push(c.sigla_partido);
        // Sempre mostrar o cargo para evitar confusão entre cargos diferentes
        if (c.cargo) sublabelParts.push(c.cargo);
        return {
          key: nodeKey(parentCtx, dim, c.sequencial ?? `${c.numero}-${i}`),
          nome: c.nome_urna ?? '—',
          sublabel: sublabelParts.length > 0 ? sublabelParts.join(' · ') : undefined,
          votos: Number(c.votos),
          // Herda o cargo real do candidato no ctx para manter filtro correto em drill-downs subsequentes
          ctx: { ...parentCtx, candidatoSeq: c.sequencial, cargo: c.cargo ?? cargo, partido: parentCtx.partido ?? c.sigla_partido },
          hasChildren: hasNext,
        };
      });
    }

    return [];
  }, [mapData, filterMunisByCtx, filterVotosByCtx, microMap, tseMicroMap, nomesMap]);

  const toggleCustomNode = useCallback(async (row: CustomNodeRow, depth: number) => {
    if (!row.hasChildren) return;
    const k = row.key;

    if (customExpanded.has(k)) {
      const next = new Set(customExpanded);
      next.delete(k);
      setCustomExpanded(next);
      return;
    }

    const next = new Set(customExpanded);
    next.add(k);
    setCustomExpanded(next);

    if (customCache.has(k)) return;
    const nextDim = customDims[depth + 1];
    if (!nextDim) return;
    const hasGrandChild = depth + 2 < customDims.length;

    setCustomLoading((s) => { const n = new Set(s); n.add(k); return n; });
    try {
      const rows = await loadCustomChildren(row.ctx, nextDim, hasGrandChild);
      setCustomCache((m) => { const n = new Map(m); n.set(k, rows); return n; });
    } catch {
      setCustomCache((m) => { const n = new Map(m); n.set(k, []); return n; });
    } finally {
      setCustomLoading((s) => { const n = new Set(s); n.delete(k); return n; });
    }
  }, [customExpanded, customCache, customDims, loadCustomChildren]);

  // Root rows for custom mode
  const [customRoot, setCustomRoot] = useState<CustomNodeRow[]>([]);
  const [customRootLoading, setCustomRootLoading] = useState(false);

  useEffect(() => {
    if (customDims.length === 0 || !mapData) {
      setCustomRoot([]);
      return;
    }
    let cancelled = false;
    setCustomRootLoading(true);
    loadCustomChildren({}, customDims[0], customDims.length > 1)
      .then((rows) => { if (!cancelled) setCustomRoot(rows); })
      .catch(() => { if (!cancelled) setCustomRoot([]); })
      .finally(() => { if (!cancelled) setCustomRootLoading(false); });
    return () => { cancelled = true; };
  }, [customDims, loadCustomChildren, mapData]);

  function customRowEl(row: CustomNodeRow, depth: number, max: number) {
    const expanded = customExpanded.has(row.key);
    return rowBase(depth, expanded, () => toggleCustomNode(row, depth), (
      <>
        <div className="flex-1 min-w-0">
          <div className={`truncate font-medium ${depth === 0 ? 'text-xs text-gray-800' : 'text-[11px] text-gray-700'} ${expanded ? 'text-primary-700' : ''}`}>
            {row.nome}
          </div>
          {row.sublabel && <div className="text-[10px] text-gray-400 truncate">{row.sublabel}</div>}
          <MiniBar votos={row.votos} max={max} />
        </div>
        <div className="shrink-0 text-right">
          <span className={`tabular-nums font-semibold text-gray-900 ${depth === 0 ? 'text-xs' : 'text-[11px]'}`}>
            {row.votos.toLocaleString('pt-BR')}
          </span>
        </div>
      </>
    ), row.hasChildren);
  }

  function renderCustomChildren(parentRow: CustomNodeRow, depth: number) {
    if (!customExpanded.has(parentRow.key)) return null;
    if (customLoading.has(parentRow.key)) return <LoadingRow depth={depth + 1} />;
    const children = customCache.get(parentRow.key);
    if (!children) return null;
    if (children.length === 0) {
      return (
        <div className="text-[11px] text-gray-400 py-2" style={{ paddingLeft: 16 + (depth + 1) * 16 }}>
          Sem dados para esta combinação.
        </div>
      );
    }
    const max = Math.max(1, ...children.map((c) => c.votos));
    return children.map((c) => (
      <div key={c.key}>
        {customRowEl(c, depth + 1, max)}
        {renderCustomChildren(c, depth + 1)}
      </div>
    ));
  }

  function renderList() {
    if (customDims.length === 0) {
      return (
        <div className="px-4 py-8 text-center text-[11px] text-gray-400">
          Adicione dimensões acima para começar.
        </div>
      );
    }
    if (customRootLoading) return <LoadingRow depth={0} />;
    if (customRoot.length === 0) {
      return <div className="px-4 py-8 text-center text-[11px] text-gray-400">Sem dados.</div>;
    }
    const sliced = topN === 999 ? customRoot : customRoot.slice(0, topN);
    const max = Math.max(1, ...sliced.map((r) => r.votos));
    return sliced.map((r) => (
      <div key={r.key}>
        {customRowEl(r, 0, max)}
        {renderCustomChildren(r, 0)}
      </div>
    ));
  }

  const cargoIsTodos = !!mapData && (mapData.metadata.cargo === 'todos' || !mapData.metadata.cargo);

  // Quando o cargo selecionado não é 'todos', a dimensão 'cargo' não faz
  // sentido (já está filtrado). Remove silenciosamente para manter consistência.
  useEffect(() => {
    if (!cargoIsTodos && customDims.includes('cargo')) {
      setCustomDims((d) => d.filter((x) => x !== 'cargo'));
    }
  }, [cargoIsTodos, customDims]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <aside
      className={`absolute inset-y-0 right-0 z-[999] w-[480px] bg-white shadow-2xl border-l border-gray-100 flex flex-col transition-transform duration-300 ease-in-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* ── Header ── */}
      <div className="px-4 pt-3 pb-2.5 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">Análise</p>
            <p className="text-[11px] text-gray-400 truncate mt-0.5">
              {mapData
                ? `${mapData.metadata.partido} · ${mapData.metadata.cargo} · ${mapData.metadata.uf} · ${mapData.metadata.ano}`
                : '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 shrink-0 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Top selector */}
        <div className="flex items-center gap-1 mt-2.5">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mr-1">Top</span>
          {([10, 20, 50, 999] as TopN[]).map((n) => (
            <Pill key={n} active={topN === n} onClick={() => setTopN(n)}>
              {n === 999 ? '∞' : n}
            </Pill>
          ))}
        </div>
      </div>

      {/* ── Analysis builder ── */}
      <AnalysisBuilder dims={customDims} onChange={setCustomDims} cargoTodos={cargoIsTodos} />

      {/* ── Column header ── */}
      <div className="shrink-0 px-4 py-1.5 border-b border-gray-100 bg-gray-50/60 flex items-center gap-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        <span className="flex-1">
          {customDims.length > 0
            ? customDims.map((d) => d[0].toUpperCase() + d.slice(1)).join(' › ')
            : 'Resultado'}
        </span>
        <span>Votos</span>
      </div>

      {/* ── Scrollable list ── */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {ibgeLoading && customDims.some((d) => d === 'macro' || d === 'micro') ? (
          <div className="px-4 py-10 text-center text-xs text-gray-400">Carregando regiões…</div>
        ) : cargoIsTodos && customDims.length > 0 && customDims[0] === 'candidato' ? (
          <div className="px-6 py-8 text-[11px] text-gray-500 leading-relaxed text-center">
            Para ranquear candidatos em <span className="font-semibold">todos os cargos</span>,
            adicione antes a dimensão <span className="font-semibold">Cargo</span> — assim cada
            candidato é ranqueado dentro da sua própria eleição.
          </div>
        ) : (() => {
          const localIdx = customDims.indexOf('local');
          const muniIdx  = customDims.indexOf('municipio');
          if (localIdx >= 0 && (muniIdx < 0 || muniIdx > localIdx)) return (
            <div className="px-6 py-8 text-[11px] text-gray-500 leading-relaxed text-center">
              A dimensão <span className="font-semibold">Local</span> requer a dimensão{' '}
              <span className="font-semibold">Município</span> antes dela na análise.
            </div>
          );
          return renderList();
        })()}
      </div>

      {/* ── Footer ── */}
      {customRoot.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-t border-gray-100 flex justify-between text-[10px] text-gray-400">
          <span>
            {topN === 999 || customRoot.length <= topN
              ? `${customRoot.length} itens`
              : `${topN} de ${customRoot.length}`}
          </span>
          <span className="tabular-nums">
            {customRoot.reduce((s, r) => s + r.votos, 0).toLocaleString('pt-BR')} votos
          </span>
        </div>
      )}
    </aside>
  );
}
