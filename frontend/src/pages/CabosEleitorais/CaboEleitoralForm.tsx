import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  caboEleitoralApi,
  type CaboEleitoral,
  type CaboInput,
  type HistoricoInput,
  type ZonaEleitoral,
  type CandidatoSearch,
  type MunicipioSearch,
  type LocalVotacao,
} from '@/services/api/cabo-eleitoral';
import { useCandidateStore } from '@/stores/candidateStore';

const ANOS = [2024, 2022, 2020, 2018, 2016];
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

interface HistoricoFormState extends HistoricoInput {
  id?: string;
  municipio_display?: string;
  _key: string;
}

interface Props {
  cabo?: CaboEleitoral | null;
  onClose: () => void;
  onSaved: () => void;
}

function gerarKey() {
  return Math.random().toString(36).slice(2);
}

/* ─── Autocomplete genérico ──────────────────────────────────── */
function Autocomplete<T>({
  value, onSearch, onSelect, renderOption, renderLabel, placeholder, disabled,
}: {
  value: string;
  onSearch: (q: string) => Promise<T[]>;
  onSelect: (item: T) => void;
  renderOption: (item: T) => React.ReactNode;
  renderLabel: (item: T) => string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!inputRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const search = (q: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const d = await onSearch(q);
        setResults(d);
        if (d.length > 0 && inputRef.current) {
          setRect(inputRef.current.getBoundingClientRect());
          setOpen(true);
        }
      } finally { setLoading(false); }
    }, 300);
  };

  const handleFocus = () => {
    if (results.length > 0 && inputRef.current) {
      setRect(inputRef.current.getBoundingClientRect());
      setOpen(true);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400 disabled:bg-gray-50 disabled:text-gray-400 pr-7"
        />
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="w-3 h-3 border border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {open && results.length > 0 && rect && createPortal(
        <div
          style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
          className="bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden max-h-44 overflow-y-auto"
        >
          {results.map((item, i) => (
            <button
              key={i} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(item); setQuery(renderLabel(item)); setOpen(false); }}
              className="w-full px-3 py-2 text-left hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-0"
            >
              {renderOption(item)}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ─── Card de apoio ──────────────────────────────────────────── */
function HistoricoCard({
  h, index, uf, onChange, onRemove,
}: {
  h: HistoricoFormState;
  index: number;
  uf?: string;
  onChange: (i: number, updated: Partial<HistoricoFormState>) => void;
  onRemove: (i: number) => void;
}) {
  const [zonaQuery, setZonaQuery] = useState('');
  const [zonaResults, setZonaResults] = useState<LocalVotacao[]>([]);
  const [zonaOpen, setZonaOpen] = useState(false);
  const [zonaLoading, setZonaLoading] = useState(false);
  const [zonaRect, setZonaRect] = useState<DOMRect | null>(null);
  const zonaInputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!zonaOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!zonaInputRef.current?.contains(target)) setZonaOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [zonaOpen]);

  const handleCandidatoSelect = (c: CandidatoSearch) => {
    onChange(index, {
      sequencial_candidato: String(c.sequencial),
      candidato_nome: c.nome_urna ?? c.nome ?? '',
      cargo: c.cargo ?? undefined,
    });
  };

  const searchZonas = (q: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    setZonaQuery(q);
    if (q.length < 2 || !h.id_municipio_tse) { setZonaResults([]); setZonaOpen(false); return; }
    debounce.current = setTimeout(async () => {
      setZonaLoading(true);
      try {
        const { data } = await caboEleitoralApi.searchLocaisVotacao(q, h.id_municipio_tse, h.ano_eleicao);
        setZonaResults(data);
        if (data.length > 0 && zonaInputRef.current) {
          setZonaRect(zonaInputRef.current.getBoundingClientRect());
          setZonaOpen(true);
        }
      } finally { setZonaLoading(false); }
    }, 300);
  };

  const addZona = (local: LocalVotacao) => {
    const jaAdicionada = h.secoes.some((z) => z.nome_local === local.nome);
    if (!jaAdicionada) {
      onChange(index, { secoes: [...h.secoes, { zona: local.zona, nome_local: local.nome }] });
    }
    setZonaQuery('');
    setZonaResults([]);
    setZonaOpen(false);
  };

  const removeZona = (zona: number) => {
    onChange(index, { secoes: h.secoes.filter((z) => z.zona !== zona) });
  };

  return (
    <div className="border border-gray-100 rounded-xl p-3 bg-gray-50 space-y-2.5">
      {/* Header do apoio */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Apoio #{index + 1}</span>
        <button type="button" onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600 transition-colors p-0.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Ano + Município lado a lado */}
      <div className="grid grid-cols-[96px_1fr] gap-2">
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Ano</label>
          <select
            value={h.ano_eleicao}
            onChange={(e) => onChange(index, { ano_eleicao: Number(e.target.value), secoes: [], candidato_nome: '', sequencial_candidato: '' })}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400"
          >
            {ANOS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 mb-0.5">Município</label>
          <Autocomplete<MunicipioSearch>
            value={h.municipio_display ?? h.municipio_nome ?? ''}
            placeholder="Digite o nome da cidade..."
            onSearch={(q) => caboEleitoralApi.searchMunicipios(q, uf).then((r) => r.data)}
            onSelect={(m) => onChange(index, {
              id_municipio_tse: m.id_municipio_tse,
              municipio_nome: m.nome,
              municipio_display: `${m.nome} - ${m.uf}`,
              secoes: [],
              candidato_nome: '',
              sequencial_candidato: '',
            })}
            renderLabel={(m) => `${m.nome} - ${m.uf}`}
            renderOption={(m) => (
              <p className="text-xs font-semibold text-gray-900">{m.nome} <span className="text-gray-400 font-normal">— {m.uf}</span></p>
            )}
          />
        </div>
      </div>

      {/* Candidato — só habilitado após selecionar município */}
      <div>
        <label className="block text-[10px] text-gray-400 mb-0.5">
          Candidato apoiado
          {!h.id_municipio_tse && <span className="ml-1 italic">(selecione o município primeiro)</span>}
        </label>
        <Autocomplete<CandidatoSearch>
          value={h.candidato_nome}
          placeholder={h.id_municipio_tse ? 'Digite o nome...' : '—'}
          disabled={!h.id_municipio_tse}
          onSearch={(q) => caboEleitoralApi.searchCandidatos(q, h.ano_eleicao, h.id_municipio_tse || undefined).then((r) => r.data)}
          onSelect={handleCandidatoSelect}
          renderLabel={(c) => c.nome_urna ?? c.nome ?? ''}
          renderOption={(c) => (
            <>
              <p className="text-xs font-semibold text-gray-900 leading-tight">{c.nome_urna ?? c.nome}</p>
              <p className="text-[10px] text-gray-400">{c.cargo} · {c.sigla_partido} · {c.ano}</p>
            </>
          )}
        />
      </div>

      {/* Zonas eleitorais */}
      <div>
        <label className="block text-[10px] text-gray-400 mb-1">
          Zonas eleitorais de apoio
          {!h.id_municipio_tse && <span className="ml-1 italic">(selecione o município primeiro)</span>}
        </label>

        {/* Busca de zona por nome */}
        <div className="relative">
          <div className="relative">
            <input
              ref={zonaInputRef}
              type="text"
              value={zonaQuery}
              disabled={!h.id_municipio_tse}
              onChange={(e) => searchZonas(e.target.value)}
              onFocus={() => {
                if (zonaResults.length > 0 && zonaInputRef.current) {
                  setZonaRect(zonaInputRef.current.getBoundingClientRect());
                  setZonaOpen(true);
                }
              }}
              placeholder="Buscar local de votação ex: ESCOLA ESTADUAL..."
              className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400 disabled:bg-gray-50 disabled:text-gray-400 pr-7"
            />
            {zonaLoading && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <div className="w-3 h-3 border border-primary-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          {zonaOpen && zonaResults.length > 0 && zonaRect && createPortal(
            <div
              style={{ position: 'fixed', top: zonaRect.bottom + 4, left: zonaRect.left, width: zonaRect.width, zIndex: 9999 }}
              className="bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden max-h-44 overflow-y-auto"
            >
              {zonaResults.map((l, i) => (
                <button
                  key={i} type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addZona(l)}
                  className="w-full px-3 py-2 text-left hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <p className="text-xs font-semibold text-gray-900 leading-tight">{l.nome}</p>
                  <p className="text-[10px] text-gray-400">Zona {l.zona}{l.bairro ? ` · ${l.bairro}` : ''}</p>
                </button>
              ))}
            </div>,
            document.body,
          )}
        </div>

        {/* Chips das zonas selecionadas */}
        {h.secoes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {h.secoes.map((z) => (
              <span
                key={z.zona}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 border border-primary-100 text-primary-700 rounded-full text-[10px] font-medium"
              >
                <span className="truncate max-w-[160px]" title={z.nome_local}>{z.nome_local}</span>
                <span className="text-primary-400">· Z{z.zona}</span>
                <button type="button" onClick={() => removeZona(z.zona)} className="ml-0.5 text-primary-400 hover:text-primary-700">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Formulário principal ───────────────────────────────────── */
export default function CaboEleitoralForm({ cabo, onClose, onSaved }: Props) {
  const estadoCopiloto = useCandidateStore((s) => s.formData?.estado);

  const [nome, setNome] = useState(cabo?.nome ?? '');
  const [telefone, setTelefone] = useState(cabo?.telefone ?? '');
  const [email, setEmail] = useState(cabo?.email ?? '');
  const [cidade, setCidade] = useState(cabo?.cidade_nome ?? '');
  const [estado, setEstado] = useState(cabo?.estado ?? estadoCopiloto ?? '');
  const [historicos, setHistoricos] = useState<HistoricoFormState[]>(
    cabo?.historicos.map((h) => ({
      ...h,
      cargo: h.cargo ?? undefined,
      municipio_nome: h.municipio_nome ?? undefined,
      municipio_display: h.municipio_nome ?? undefined,
      secoes: h.secoes as ZonaEleitoral[],
      _key: gerarKey(),
    })) ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fmt = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const addHistorico = () => setHistoricos((prev) => [
    ...prev,
    { _key: gerarKey(), ano_eleicao: 2024, sequencial_candidato: '', candidato_nome: '', id_municipio_tse: 0, secoes: [] },
  ]);

  const updateHistorico = (i: number, updated: Partial<HistoricoFormState>) =>
    setHistoricos((prev) => prev.map((h, idx) => idx === i ? { ...h, ...updated } : h));

  const removeHistorico = (i: number) =>
    setHistoricos((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { setError('Nome é obrigatório'); return; }
    setSaving(true);
    setError('');

    const validos = historicos.filter((h) => h.sequencial_candidato && h.id_municipio_tse);

    try {
      if (cabo) {
        await caboEleitoralApi.update(cabo.id, { nome, telefone, email, cidade_nome: cidade, estado });

        const existingIds = new Set(cabo.historicos.map((h) => h.id));
        const validosIds = new Set(validos.map((h) => h.id).filter(Boolean));

        // Deletar historicos que foram removidos do formulário
        for (const h of cabo.historicos) {
          if (!validosIds.has(h.id)) {
            await caboEleitoralApi.deleteHistorico(cabo.id, h.id);
          }
        }

        for (const h of validos) {
          const payload = {
            ano_eleicao: h.ano_eleicao,
            sequencial_candidato: h.sequencial_candidato,
            candidato_nome: h.candidato_nome,
            cargo: h.cargo,
            id_municipio_tse: h.id_municipio_tse,
            municipio_nome: h.municipio_nome,
            secoes: h.secoes,
          };
          if (h.id && existingIds.has(h.id)) {
            // Atualiza existente — recalcula votos com as zonas atuais
            await caboEleitoralApi.updateHistorico(cabo.id, h.id, payload);
          } else {
            // Novo histórico
            await caboEleitoralApi.addHistorico(cabo.id, payload);
          }
        }
      } else {
        const payload: CaboInput = {
          nome,
          telefone: telefone || undefined,
          email: email || undefined,
          cidade_nome: cidade || undefined,
          estado: estado || undefined,
          historicos: validos.map((h) => ({
            ano_eleicao: h.ano_eleicao,
            sequencial_candidato: h.sequencial_candidato,
            candidato_nome: h.candidato_nome,
            cargo: h.cargo,
            id_municipio_tse: h.id_municipio_tse,
            municipio_nome: h.municipio_nome,
            secoes: h.secoes,
          })),
        };
        await caboEleitoralApi.create(payload);
      }
      onSaved();
    } catch {
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-sm font-bold text-gray-900">
            {cabo ? 'Editar Cabo Eleitoral' : 'Novo Cabo Eleitoral'}
          </h2>
          <button type="button" onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — scroll apenas se necessário */}
        <form id="cabo-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Linha 1: Nome + Telefone + Email */}
          <div className="grid grid-cols-[1fr_160px_200px] gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nome <span className="text-red-400">*</span></label>
              <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
                placeholder="Nome completo" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Telefone</label>
              <input type="text" value={telefone} onChange={(e) => setTelefone(fmt(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
                placeholder="(00) 00000-0000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
                placeholder="email@exemplo.com" />
            </div>
          </div>

          {/* Linha 2: Cidade + Estado */}
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Cidade</label>
              <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary-400"
                placeholder="Ex: Viçosa" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Estado</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-primary-400">
                <option value="">UF</option>
                {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
          </div>

          {/* Divisor + título */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Histórico de apoio</p>
            <button type="button" onClick={addHistorico}
              className="text-[11px] text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Adicionar apoio
            </button>
          </div>

          {historicos.length === 0 ? (
            <div className="text-center py-5 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
              Clique em "Adicionar apoio" para informar quem este cabo apoiou.
            </div>
          ) : (
            <div className="space-y-3">
              {historicos.map((h, i) => (
                <HistoricoCard
                  key={h._key} h={h} index={i} uf={estado}
                  onChange={updateHistorico} onRemove={removeHistorico}
                />
              ))}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" form="cabo-form" disabled={saving}
            className="px-5 py-2 text-xs font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            {saving && <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

      </div>
    </div>
  );
}
