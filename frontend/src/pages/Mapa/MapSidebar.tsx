import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '@/components/Logo';
import type { MapData } from './index';

interface Props {
  mapData: MapData | null;
  anosDisponiveis: number[];
  selectedCargo: string;
  cargosDisponiveis: string[];
  onYearChange: (ano: number) => void;
  onCargoChange: (cargo: string) => void;
}

const CARGO_LABELS: Record<string, string> = {
  todos: 'Todos os cargos',
  'deputado estadual': 'Dep. Estadual',
  'deputado federal': 'Dep. Federal',
  vereador: 'Vereador',
  prefeito: 'Prefeito',
  senador: 'Senador',
  governador: 'Governador',
  presidente: 'Presidente',
};

function YearPicker({ ano, anos, onChange }: { ano: number; anos: number[]; onChange: (a: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] bg-primary-50 text-primary-600 font-semibold px-2 py-0.5 rounded-full border border-primary-100 hover:bg-primary-100 transition-colors mt-0.5"
        title="Trocar ano"
      >
        {ano}
        <svg className={`w-2.5 h-2.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[72px]">
          {anos.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => { onChange(a); setOpen(false); }}
              className={`w-full px-3 py-1.5 text-xs text-left font-medium transition-colors ${
                a === ano
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CargoPicker({ cargo, cargos, onChange }: { cargo: string; cargos: string[]; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const allOptions = ['todos', ...cargos];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] bg-gray-50 text-gray-600 font-semibold px-2 py-0.5 rounded-full border border-gray-200 hover:bg-gray-100 transition-colors max-w-[120px]"
        title="Filtrar por cargo"
      >
        <span className="truncate">{CARGO_LABELS[cargo] ?? cargo}</span>
        <svg className={`w-2.5 h-2.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[140px]">
          {allOptions.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              className={`w-full px-3 py-1.5 text-xs text-left font-medium transition-colors ${
                c === cargo
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {CARGO_LABELS[c] ?? c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MapSidebar({ mapData, anosDisponiveis, selectedCargo, cargosDisponiveis, onYearChange, onCargoChange }: Props) {
  const navigate = useNavigate();

  const stats = useMemo(() => {
    if (!mapData) return null;
    const { features, metadata } = mapData;

    const totalPartido = metadata.totalVotosPartido;
    const totalGeral = features.reduce((s, f) => s + f.properties.votosTotal, 0);
    const sharePartido = totalGeral > 0 ? (totalPartido / totalGeral) * 100 : 0;

    const top5 = [...features]
      .sort((a, b) => b.properties.votosPartido - a.properties.votosPartido)
      .slice(0, 5)
      .map((f) => f.properties);

    return { totalPartido, totalGeral, sharePartido, top5 };
  }, [mapData]);

  const regiao = mapData?.metadata.microrregiao ?? mapData?.metadata.macrorregiao;

  return (
    <aside className="w-72 bg-white border-r border-gray-100 h-full flex flex-col">

      {/* Brand */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100 shrink-0">
        <BrandLogo />
      </div>

      {/* Candidate header */}
      <div className="px-5 pt-4 pb-4 border-b border-gray-100 shrink-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h2 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 flex-1">
            {mapData?.metadata.nomeUrna ?? '—'}
          </h2>
          {mapData && anosDisponiveis.length > 1 ? (
            <YearPicker
              ano={mapData.metadata.ano}
              anos={anosDisponiveis}
              onChange={onYearChange}
            />
          ) : (
            <span className="shrink-0 text-[10px] bg-primary-50 text-primary-600 font-semibold px-2 py-0.5 rounded-full border border-primary-100 mt-0.5">
              {mapData?.metadata.ano ?? '—'}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-1.5">
          <p className="text-[11px] text-gray-400 leading-tight">
            <span className="font-semibold text-gray-600">{mapData?.metadata.partido ?? '—'}</span>
            {' · '}
            <span>{mapData?.metadata.uf ?? '—'}</span>
          </p>
          {mapData && (
            <CargoPicker
              cargo={selectedCargo}
              cargos={cargosDisponiveis}
              onChange={onCargoChange}
            />
          )}
        </div>

        {regiao && (
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-primary-700 bg-primary-50 rounded-lg px-2.5 py-1.5 border border-primary-100">
            <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium truncate">{regiao}</span>
          </div>
        )}
      </div>

      {stats && mapData ? (
        <div className="flex-1 min-h-0 flex flex-col px-5 py-4 gap-5">

          {/* Hero metric */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
              Share de votos válidos
            </p>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-5xl font-extrabold text-gray-900 tracking-tighter leading-none">
                {stats.sharePartido.toFixed(1)}
              </span>
              <span className="text-xl text-gray-400 font-medium mb-1">%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(stats.sharePartido * 2, 100)}%`,
                  background: 'linear-gradient(90deg, #4ade80, #16a34a)',
                }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">do partido no estado</p>
          </div>

          {/* Vote totals */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-primary-50 border border-primary-100 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-gray-500 truncate leading-tight">
                {mapData.metadata.partido}
              </p>
              <p className="text-sm font-bold text-primary-700 mt-0.5 tracking-tight">
                {stats.totalPartido.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
              <p className="text-[10px] text-gray-500 leading-tight">Votos válidos</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5 tracking-tight">
                {stats.totalGeral.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>

          {/* Top 5 */}
          <div className="flex-1 min-h-0 flex flex-col">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3 shrink-0">
              Top 5 Municípios
            </p>
            <div className="space-y-3">
              {(() => {
                const maxPct = Math.max(...stats.top5.map((m) => m.percentual), 0.001);
                return stats.top5.map((m, i) => {
                const pct = (m.percentual / maxPct) * 100;
                return (
                  <div key={m.municipioTse}>
                    <div className="flex items-center gap-2 text-xs mb-1">
                      <span className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-500 shrink-0">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-gray-700 font-medium">{m.municipioNome}</span>
                      <div className="text-right shrink-0">
                        <span className="font-semibold text-gray-900">
                          {m.votosPartido.toLocaleString('pt-BR')}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-1">{m.percentual.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="ml-6 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              });
              })()}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-3" />
            <p className="text-xs text-gray-400">Carregando dados…</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 shrink-0">
        <button
          onClick={() => navigate('/copiloto')}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-primary-600 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Editar Copiloto
        </button>
        <p className="text-[10px] text-gray-300 text-center mt-1">
          Passe o mouse nos círculos para detalhes
        </p>
      </div>
    </aside>
  );
}
