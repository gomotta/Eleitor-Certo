import { useEffect, useState, useMemo } from 'react';
import { geoApi, type Estado, type MacroRegiao, type MicroRegiao, type Partido } from '@/services/api/geo';
import { mapaApi } from '@/services/api/mapa';
import type { MapData } from './index';

export interface GeoTarget {
  type: 'macro' | 'micro' | 'cidade';
  nome: string;
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

export default function MapFilterPanel({ open, onClose, mapData, defaultUF, candidateId, onApply, onReset }: Props) {
  const [estado, setEstado] = useState(defaultUF);
  const [selectedMacro, setSelectedMacro] = useState<MacroRegiao | null>(null);
  const [selectedMicro, setSelectedMicro] = useState<MicroRegiao | null>(null);
  const [selectedCidade, setSelectedCidade] = useState<{ nome: string; tse: number } | null>(null);
  const [ideologia, setIdeologia] = useState<string | null>(null);
  const [partido, setPartido] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [estados, setEstados] = useState<Estado[]>([]);
  const [macros, setMacros] = useState<MacroRegiao[]>([]);
  const [micros, setMicros] = useState<MicroRegiao[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);

  // Carga inicial
  useEffect(() => {
    geoApi.getEstados().then((r) => setEstados(r.data));
    geoApi.getPartidos().then((r) => setPartidos(r.data));
  }, []);

  // Cascata geográfica
  useEffect(() => {
    setSelectedMacro(null);
    setSelectedMicro(null);
    setSelectedCidade(null);
    setMacros([]);
    setMicros([]);
    if (estado) {
      geoApi.getMacroRegioes(estado).then((r) => setMacros(r.data));
    }
  }, [estado]);

  useEffect(() => {
    setSelectedMicro(null);
    setMicros([]);
    if (selectedMacro) {
      geoApi.getMicroRegioes(selectedMacro.id).then((r) => setMicros(r.data));
    }
  }, [selectedMacro]);

  // Cidades derivadas de mapData filtradas pela micro selecionada
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

  // Reset quando abre o painel
  useEffect(() => {
    if (open) {
      setEstado(defaultUF);
      setSelectedMacro(null);
      setSelectedMicro(null);
      setSelectedCidade(null);
      setIdeologia(null);
      setPartido(null);
    }
  }, [open, defaultUF]);

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
    ? { type: 'micro', nome: selectedMicro.nome }
    : selectedMacro
    ? { type: 'macro', nome: selectedMacro.nome }
    : undefined;

  const needsBackend = estado !== defaultUF || !!partido || !!ideologia;

  const handleApply = async () => {
    if (!mapData) return;
    setLoading(true);
    try {
      if (needsBackend) {
        const resp = await mapaApi.getFilteredDados(candidateId, {
          estado: estado !== defaultUF ? estado : undefined,
          partido: partido || undefined,
          ideologia: !partido && ideologia ? ideologia : undefined,
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
      {/* Backdrop sutil */}
      {open && (
        <div
          className="absolute inset-0 z-[998]"
          onClick={onClose}
        />
      )}

      {/* Painel */}
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
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 px-4 py-3 space-y-3">

          {/* ── Localização ── */}
          <section>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Localização</p>

            <div className="space-y-2">
              <div>
                <label className="label">Estado</label>
                <select className="input" value={estado} onChange={(e) => setEstado(e.target.value)}>
                  {estados.map((e) => (
                    <option key={e.sigla} value={e.sigla}>{e.sigla} — {e.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Macrorregião <span className="text-gray-400 font-normal">(zoom)</span></label>
                <select
                  className="input"
                  value={selectedMacro?.id ?? ''}
                  onChange={(e) => {
                    const m = macros.find((x) => x.id === Number(e.target.value));
                    setSelectedMacro(m ?? null);
                  }}
                  disabled={macros.length === 0}
                >
                  <option value="">Todas</option>
                  {macros.map((m) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Microrregião <span className="text-gray-400 font-normal">(zoom)</span></label>
                <select
                  className="input"
                  value={selectedMicro?.id ?? ''}
                  onChange={(e) => {
                    const m = micros.find((x) => x.id === Number(e.target.value));
                    setSelectedMicro(m ?? null);
                  }}
                  disabled={micros.length === 0}
                >
                  <option value="">Todas</option>
                  {micros.map((m) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Cidade <span className="text-gray-400 font-normal">(zoom)</span></label>
                <select
                  className="input"
                  value={selectedCidade?.tse ?? ''}
                  onChange={(e) => {
                    const tse = Number(e.target.value);
                    const c = cidadesDisponiveis.find((x) => x.tse === tse);
                    setSelectedCidade(c ?? null);
                  }}
                  disabled={cidadesDisponiveis.length === 0}
                >
                  <option value="">Todas</option>
                  {cidadesDisponiveis.map((c) => (
                    <option key={c.tse} value={c.tse}>{c.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* ── Dados eleitorais ── */}
          <section className="border-t border-gray-100 pt-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Dados eleitorais</p>

            <div className="space-y-2">
              <div>
                <label className="label">Ideologia</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {ideologias.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => { setIdeologia(ideologia === id ? null : id); setPartido(null); }}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                        ideologia === id
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
                      }`}
                    >
                      {id}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Partido</label>
                <select
                  className="input"
                  value={partido ?? ''}
                  onChange={(e) => setPartido(e.target.value || null)}
                >
                  <option value="">Padrão do copiloto</option>
                  {partidosFiltrados.map((p) => (
                    <option key={p.sigla} value={p.sigla}>{p.sigla} — {p.nome}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-3 flex gap-3">
          <button
            type="button"
            onClick={onReset}
            className="flex-1 btn-secondary text-sm"
          >
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
