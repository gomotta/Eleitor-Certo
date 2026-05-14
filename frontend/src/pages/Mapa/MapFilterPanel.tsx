import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { geoApi, type MacroRegiao, type MicroRegiao, type Partido, type CandidatoSugestao } from '@/services/api/geo';
import { mapaApi } from '@/services/api/mapa';
import type { MapData } from './index';

export interface GeoTarget {
  type: 'macro' | 'micro' | 'cidade';
  nome: string;
  macroId?: number;
  microId?: number;
  microIds?: number[];
  municipioTse?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mapData: MapData | null;
  defaultUF: string;
  candidateId: string;
  onApply: (mapData: MapData, geo?: GeoTarget) => void;
  onReset: () => void;
}

// ── Componente genérico de busca com drilldown ──────────────────────────────

interface SearchItem {
  id: string | number;
  label: string;
  sublabel?: string;
}

function SearchSelect({
  label,
  placeholder = 'Buscar…',
  items,
  selected,
  onSelect,
  onClear,
  disabled,
}: {
  label: React.ReactNode;
  placeholder?: string;
  items: SearchItem[];
  selected: SearchItem | null;
  onSelect: (item: SearchItem) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q
      ? items.filter(
          (i) =>
            i.label.toLowerCase().includes(q) ||
            (i.sublabel?.toLowerCase().includes(q) ?? false),
        )
      : items;
    return list.slice(0, 40);
  }, [items, query]);

  if (selected) {
    return (
      <div>
        <label className="label">{label}</label>
        <div className="flex items-center gap-2 mt-1 px-2.5 py-1.5 bg-primary-50 border border-primary-200 rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary-800 truncate">{selected.label}</p>
            {selected.sublabel && (
              <p className="text-[10px] text-primary-500 truncate">{selected.sublabel}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { onClear(); setQuery(''); }}
            className="text-primary-400 hover:text-primary-700 flex-shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative mt-1">
        <input
          type="text"
          className="input disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder={disabled ? '—' : placeholder}
          value={query}
          disabled={disabled}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && !disabled && filtered.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={() => { onSelect(item); setQuery(''); setOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-0"
              >
                <p className="text-xs font-medium text-gray-800">{item.label}</p>
                {item.sublabel && <p className="text-[10px] text-gray-400">{item.sublabel}</p>}
              </button>
            ))}
          </div>
        )}
        {open && !disabled && query.length >= 1 && filtered.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
            <p className="text-xs text-gray-400">Nenhum resultado</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Painel principal ─────────────────────────────────────────────────────────

export default function MapFilterPanel({ open, onClose, mapData, defaultUF, candidateId, onApply, onReset }: Props) {
  const [selectedMacro, setSelectedMacro] = useState<MacroRegiao | null>(null);
  const [selectedMicro, setSelectedMicro] = useState<MicroRegiao | null>(null);
  const [selectedCidade, setSelectedCidade] = useState<{ nome: string; tse: number } | null>(null);
  const [ideologia, setIdeologia] = useState<string | null>(null);
  const [partido, setPartido] = useState<string | null>(null);
  const [candidatoQuery, setCandidatoQuery] = useState('');
  const [candidatoSelecionado, setCandidatoSelecionado] = useState<CandidatoSugestao | null>(null);
  const [sugestoes, setSugestoes] = useState<CandidatoSugestao[]>([]);
  const [buscandoCandidato, setBuscandoCandidato] = useState(false);
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(false);

  const [macros, setMacros] = useState<MacroRegiao[]>([]);
  const [micros, setMicros] = useState<MicroRegiao[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);

  const partidoAtivo = partido ?? mapData?.metadata.partido ?? '';
  const cargoAtivo = mapData?.metadata.cargo ?? '';
  const anoAtivo = mapData?.metadata.ano ?? 2022;

  // Busca debounced de candidatos
  const buscarCandidatos = useCallback((q: string) => {
    if (!q || q.length < 2 || !cargoAtivo) {
      setSugestoes([]);
      return;
    }
    setBuscandoCandidato(true);
    geoApi
      .searchCandidatos({ uf: defaultUF, cargo: cargoAtivo, ano: anoAtivo, partido: partidoAtivo || undefined, q })
      .then((r) => { setSugestoes(r.data); setDropdownAberto(true); })
      .catch(() => setSugestoes([]))
      .finally(() => setBuscandoCandidato(false));
  }, [defaultUF, partidoAtivo, cargoAtivo, anoAtivo]);

  const handleCandidatoInput = (q: string) => {
    setCandidatoQuery(q);
    setCandidatoSelecionado(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarCandidatos(q), 300);
  };

  // Carga inicial
  useEffect(() => {
    geoApi.getPartidos().then((r) => setPartidos(r.data));
    if (defaultUF) geoApi.getMacroRegioes(defaultUF).then((r) => setMacros(r.data));
  }, [defaultUF]);

  // Cascata macro → micro
  useEffect(() => {
    setSelectedMicro(null);
    setMicros([]);
    if (selectedMacro) geoApi.getMicroRegioes(selectedMacro.id).then((r) => setMicros(r.data));
  }, [selectedMacro]);

  // Cidades derivadas de mapData, filtradas pela micro se selecionada
  const cidadesDisponiveis = useMemo(() => {
    if (!mapData) return [];
    let features = mapData.features;
    if (selectedMicro) {
      const byId = features.filter((f) => f.properties.microRegiaoId === selectedMicro.id);
      if (byId.length > 0) features = byId;
    }
    return [...features]
      .map((f) => ({ nome: f.properties.municipioNome, tse: f.properties.municipioTse }))
      .filter((c) => c.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [mapData, selectedMicro]);


  const ideologias = useMemo(
    () => [...new Set(partidos.map((p) => p.ideologia).filter(Boolean))].sort(),
    [partidos],
  );

  const partidosFiltrados = useMemo(
    () => (ideologia ? partidos.filter((p) => p.ideologia === ideologia) : partidos),
    [partidos, ideologia],
  );

  const geoTarget: GeoTarget | undefined = selectedCidade
    ? { type: 'cidade', nome: selectedCidade.nome, municipioTse: selectedCidade.tse }
    : selectedMicro
    ? { type: 'micro', nome: selectedMicro.nome, microId: selectedMicro.id }
    : selectedMacro
    ? { type: 'macro', nome: selectedMacro.nome, macroId: selectedMacro.id, microIds: micros.map((m) => m.id) }
    : undefined;

  const needsBackend = !!partido || !!ideologia || !!candidatoSelecionado;

  const handleApply = async () => {
    if (!mapData) return;
    setLoading(true);
    try {
      if (needsBackend) {
        const resp = await mapaApi.getFilteredDados(candidateId, {
          partido: partido || undefined,
          ideologia: !partido && ideologia ? ideologia : undefined,
          candidatoSequencial: candidatoSelecionado?.sequencial || undefined,
          candidatoNomeUrna: candidatoSelecionado?.nome_urna || undefined,
        });
        onApply(resp.data as MapData, geoTarget);
      } else {
        onApply(mapData, geoTarget);
      }
    } catch (err) {
      console.error('Erro ao aplicar filtros:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {open && <div className="absolute inset-0 z-[998]" onClick={onClose} />}

      <div
        className={`absolute inset-y-0 right-0 w-80 bg-white shadow-2xl z-[999] flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            <h2 className="font-semibold text-gray-800 text-sm">Filtros do Mapa</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

          {/* ── Localização ── */}
          <section>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Localização</p>
            <div className="space-y-2">
              <SearchSelect
                label={<>Macrorregião <span className="text-gray-400 font-normal">(zoom)</span></>}
                placeholder="Buscar mesorregião…"
                items={macros.map((m) => ({ id: m.id, label: m.nome }))}
                selected={selectedMacro ? { id: selectedMacro.id, label: selectedMacro.nome } : null}
                onSelect={(item) => setSelectedMacro(macros.find((m) => m.id === item.id) ?? null)}
                onClear={() => { setSelectedMacro(null); setSelectedMicro(null); setSelectedCidade(null); }}
                disabled={macros.length === 0}
              />

              <SearchSelect
                label={<>Microrregião <span className="text-gray-400 font-normal">(zoom)</span></>}
                placeholder="Selecione a macro primeiro…"
                items={micros.map((m) => ({ id: m.id, label: m.nome }))}
                selected={selectedMicro ? { id: selectedMicro.id, label: selectedMicro.nome } : null}
                onSelect={(item) => setSelectedMicro(micros.find((m) => m.id === item.id) ?? null)}
                onClear={() => { setSelectedMicro(null); setSelectedCidade(null); }}
                disabled={!selectedMacro}
              />

              <SearchSelect
                label={<>Cidade <span className="text-gray-400 font-normal">(zoom)</span></>}
                placeholder="Buscar município…"
                items={cidadesDisponiveis.map((c) => ({ id: c.tse, label: c.nome }))}
                selected={selectedCidade ? { id: selectedCidade.tse, label: selectedCidade.nome } : null}
                onSelect={(item) => setSelectedCidade({ nome: item.label, tse: item.id as number })}
                onClear={() => setSelectedCidade(null)}
                disabled={!mapData}
              />
            </div>
          </section>

          {/* ── Dados eleitorais ── */}
          <section className="border-t border-gray-100 pt-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Dados eleitorais</p>
            <div className="space-y-2">

              <SearchSelect
                label="Ideologia"
                placeholder="Buscar ideologia…"
                items={ideologias.map((id) => ({ id, label: id }))}
                selected={ideologia ? { id: ideologia, label: ideologia } : null}
                onSelect={(item) => {
                  setIdeologia(item.id as string);
                  setPartido(null);
                  setCandidatoSelecionado(null);
                  setCandidatoQuery('');
                  setSugestoes([]);
                }}
                onClear={() => setIdeologia(null)}
              />

              <SearchSelect
                label="Partido"
                placeholder="Buscar partido…"
                items={partidosFiltrados.map((p) => ({ id: p.sigla, label: p.sigla, sublabel: p.nome }))}
                selected={
                  partido
                    ? {
                        id: partido,
                        label: partido,
                        sublabel: partidosFiltrados.find((p) => p.sigla === partido)?.nome,
                      }
                    : null
                }
                onSelect={(item) => {
                  setPartido(item.id as string);
                  setCandidatoSelecionado(null);
                  setCandidatoQuery('');
                  setSugestoes([]);
                }}
                onClear={() => {
                  setPartido(null);
                  setCandidatoSelecionado(null);
                  setCandidatoQuery('');
                  setSugestoes([]);
                }}
              />

              {/* ── Busca de candidato ── */}
              <div>
                <label className="label">
                  Candidato
                  {partidoAtivo
                    ? <span className="text-gray-400 font-normal ml-1">({partidoAtivo})</span>
                    : <span className="text-gray-400 font-normal ml-1">(todos os partidos)</span>
                  }
                </label>

                {candidatoSelecionado ? (
                  <div className="flex items-center gap-2 mt-1 px-2.5 py-1.5 bg-primary-50 border border-primary-200 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-primary-800 truncate">{candidatoSelecionado.nome_urna}</p>
                      <p className="text-[10px] text-primary-500">
                        {[candidatoSelecionado.sigla_partido, candidatoSelecionado.numero ? `Nº ${candidatoSelecionado.numero}` : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCandidatoSelecionado(null); setCandidatoQuery(''); setSugestoes([]); }}
                      className="text-primary-400 hover:text-primary-700 flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="relative mt-1">
                    <div className="relative">
                      <input
                        type="text"
                        className="input pr-8"
                        placeholder="Buscar por nome…"
                        value={candidatoQuery}
                        onChange={(e) => handleCandidatoInput(e.target.value)}
                        onFocus={() => sugestoes.length > 0 && setDropdownAberto(true)}
                        onBlur={() => setTimeout(() => setDropdownAberto(false), 150)}
                      />
                      {buscandoCandidato && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          <div className="w-3.5 h-3.5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>

                    {dropdownAberto && sugestoes.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {sugestoes.map((c) => (
                          <button
                            key={c.sequencial}
                            type="button"
                            onMouseDown={() => {
                              setCandidatoSelecionado(c);
                              setCandidatoQuery('');
                              setSugestoes([]);
                              setDropdownAberto(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-0"
                          >
                            <p className="text-xs font-medium text-gray-800">{c.nome_urna}</p>
                            <p className="text-[10px] text-gray-400">
                              {[c.sigla_partido, c.numero ? `Nº ${c.numero}` : null].filter(Boolean).join(' · ')}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}

                    {dropdownAberto && !buscandoCandidato && candidatoQuery.length >= 2 && sugestoes.length === 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
                        <p className="text-xs text-gray-400">Nenhum candidato encontrado</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-3 flex gap-3">
          <button type="button" onClick={() => { setSelectedMacro(null); setSelectedMicro(null); setSelectedCidade(null); setIdeologia(null); setPartido(null); setCandidatoQuery(''); setCandidatoSelecionado(null); setSugestoes([]); onReset(); }} className="flex-1 btn-secondary text-sm">
            Resetar
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={loading}
            className="flex-1 btn-primary text-sm disabled:opacity-50"
          >
            {loading ? 'Carregando…' : 'Aplicar'}
          </button>
        </div>
      </div>
    </>
  );
}
