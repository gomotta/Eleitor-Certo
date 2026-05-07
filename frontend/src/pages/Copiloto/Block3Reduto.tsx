import { useEffect, useState } from 'react';
import { useCandidateStore } from '@/stores/candidateStore';
import { geoApi, type Estado, type Cidade, type MacroRegiao, type MicroRegiao } from '@/services/api/geo';

const ChevronDown = () => (
  <svg className="w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const Spinner = () => (
  <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
    Carregando…
  </div>
);

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export default function Block3Reduto({ onNext, onBack }: Props) {
  const { formData, updateFormData } = useCandidateStore();
  const cargo = formData.cargo;

  const [estados, setEstados]         = useState<Estado[]>([]);
  const [cidades, setCidades]         = useState<Cidade[]>([]);
  const [macroRegioes, setMacroRegioes] = useState<MacroRegiao[]>([]);
  const [microRegioes, setMicroRegioes] = useState<MicroRegiao[]>([]);
  const [loadingCidades, setLoadingCidades]       = useState(false);
  const [loadingMacro, setLoadingMacro]           = useState(false);
  const [loadingMicro, setLoadingMicro]           = useState(false);
  const [erroCidades, setErroCidades]             = useState(false);
  const [erroMacro, setErroMacro]                 = useState(false);

  const precisaCidade = cargo === 'VEREADOR' || cargo === 'PREFEITO_VICE';
  const precisaRegiao = cargo === 'DEPUTADO_ESTADUAL' || cargo === 'DEPUTADO_FEDERAL';
  const nacional      = cargo === 'PRESIDENTE_VICE';

  // Carrega estados uma vez
  useEffect(() => {
    if (nacional) return;
    geoApi.getEstados().then((r) => setEstados(r.data)).catch(() => {});
  }, [nacional]);

  // Carrega cidades ou macrorregiões quando o estado muda
  useEffect(() => {
    if (!formData.estado) return;

    if (precisaCidade) {
      setLoadingCidades(true);
      setErroCidades(false);
      setCidades([]);
      geoApi.getCidades(formData.estado)
        .then((r) => setCidades(r.data))
        .catch(() => setErroCidades(true))
        .finally(() => setLoadingCidades(false));
    }

    if (precisaRegiao) {
      setLoadingMacro(true);
      setErroMacro(false);
      setMacroRegioes([]);
      setMicroRegioes([]);
      geoApi.getMacroRegioes(formData.estado)
        .then((r) => setMacroRegioes(r.data))
        .catch(() => setErroMacro(true))
        .finally(() => setLoadingMacro(false));
    }
  // precisaRegiao e precisaCidade precisam estar no array para reagir caso
  // o cargo ainda não estivesse disponível na primeira renderização
  }, [formData.estado, precisaRegiao, precisaCidade]);

  const handleEstadoChange = (sigla: string) => {
    // Reseta tudo que depende do estado ao trocar
    updateFormData({
      estado: sigla,
      cidade: undefined,
      macroRegiao: [],
      microRegiao: [],
    });
    setMacroRegioes([]);
    setMicroRegioes([]);
    setCidades([]);
  };

  const handleMacroChange = async (macro: MacroRegiao) => {
    const isSelected = (formData.macroRegiao ?? []).includes(macro.nome);
    updateFormData({ macroRegiao: isSelected ? [] : [macro.nome], microRegiao: [] });
    setMicroRegioes([]);

    if (!isSelected) {
      setLoadingMicro(true);
      try {
        const r = await geoApi.getMicroRegioes(macro.id);
        setMicroRegioes(r.data);
      } catch {
        // falha silenciosa — microrregião é opcional
      } finally {
        setLoadingMicro(false);
      }
    }
  };

  const isValid = () => {
    if (nacional) return true;
    if (!formData.estado) return false;
    if (precisaCidade) return !!formData.cidade;
    return true;
  };

  const navButtons = (
    <div className="flex justify-between pt-4">
      <button type="button" onClick={onBack} className="btn-secondary">
        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Voltar
      </button>
      <button type="button" onClick={onNext} disabled={!isValid()} className="btn-primary disabled:opacity-40">
        Avançar
        <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );

  if (nacional) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3 bg-primary-50 border border-primary-100 rounded-xl p-5">
          <span className="text-2xl leading-none">🗺️</span>
          <div>
            <p className="font-semibold text-primary-800">Candidatura nacional</p>
            <p className="text-sm text-primary-600 mt-1">
              Sua candidatura abrange todo o território nacional. O mapa exibirá dados de todos os estados do Brasil.
            </p>
          </div>
        </div>
        {navButtons}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Estado */}
      <div>
        <label className="label">Estado *</label>
        <div className="relative">
          <select
            value={formData.estado ?? ''}
            onChange={(e) => handleEstadoChange(e.target.value)}
            className="input appearance-none pr-10 cursor-pointer"
          >
            <option value="">Selecione o estado</option>
            {estados.map((e) => (
              <option key={e.sigla} value={e.sigla}>{e.sigla} — {e.nome}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <ChevronDown />
          </div>
        </div>
      </div>

      {/* Cidade */}
      {precisaCidade && formData.estado && (
        <div>
          <label className="label">Cidade *</label>
          {loadingCidades ? <Spinner /> : erroCidades ? (
            <p className="text-sm text-red-500">Erro ao carregar cidades. Tente trocar o estado.</p>
          ) : (
            <div className="relative">
              <select
                value={formData.cidade ?? ''}
                onChange={(e) => updateFormData({ cidade: e.target.value })}
                className="input appearance-none pr-10 cursor-pointer"
              >
                <option value="">Selecione a cidade</option>
                {cidades.map((c) => (
                  <option key={c.id} value={c.nome}>{c.nome}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <ChevronDown />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Macrorregiões */}
      {precisaRegiao && formData.estado && (
        <>
          <div>
            <label className="label">
              Macrorregião
              <span className="ml-1.5 text-gray-400 font-normal text-xs">(selecione uma)</span>
            </label>
            {loadingMacro ? <Spinner /> : erroMacro ? (
              <p className="text-sm text-red-500 mt-1">Erro ao carregar macrorregiões. Tente trocar o estado.</p>
            ) : macroRegioes.length === 0 ? (
              <p className="text-sm text-gray-400 mt-1">Nenhuma macrorregião encontrada para este estado.</p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-1.5">
                {macroRegioes.map((m) => {
                  const checked = (formData.macroRegiao ?? []).includes(m.nome);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-all ${
                        checked
                          ? 'border-primary-300 bg-primary-50'
                          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        checked ? 'bg-primary-600 border-primary-600' : 'border-gray-300 bg-white'
                      }`}>
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <input type="checkbox" checked={checked} onChange={() => handleMacroChange(m)} className="sr-only" />
                      <span className={`text-sm ${checked ? 'text-primary-800 font-medium' : 'text-gray-700'}`}>
                        {m.nome}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Microrregiões */}
          {(formData.macroRegiao ?? []).length > 0 && (
            <div>
              <label className="label">
                Microrregião
                <span className="ml-1.5 text-gray-400 font-normal text-xs">(selecione uma)</span>
              </label>
              {loadingMicro ? <Spinner /> : microRegioes.length === 0 ? (
                <p className="text-sm text-gray-400 mt-1">Nenhuma microrregião disponível.</p>
              ) : (
                <div className="mt-2 grid grid-cols-1 gap-1.5">
                  {microRegioes.map((m) => {
                    const isChecked = (formData.microRegiao ?? []).includes(m.nome);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? 'border-primary-300 bg-primary-50'
                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          isChecked ? 'bg-primary-600 border-primary-600' : 'border-gray-300 bg-white'
                        }`}>
                          {isChecked && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => updateFormData({ microRegiao: isChecked ? [] : [m.nome] })}
                          className="sr-only"
                        />
                        <span className={`text-sm ${isChecked ? 'text-primary-800 font-medium' : 'text-gray-700'}`}>
                          {m.nome}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {navButtons}
    </div>
  );
}
