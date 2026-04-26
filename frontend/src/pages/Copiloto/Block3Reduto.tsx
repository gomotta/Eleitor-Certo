import { useEffect, useState } from 'react';
import { useCandidateStore } from '@/stores/candidateStore';
import { geoApi, type Estado, type Cidade, type MacroRegiao, type MicroRegiao } from '@/services/api/geo';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export default function Block3Reduto({ onNext, onBack }: Props) {
  const { formData, updateFormData } = useCandidateStore();
  const cargo = formData.cargo;

  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [macroRegioes, setMacroRegioes] = useState<MacroRegiao[]>([]);
  const [microRegioes, setMicroRegioes] = useState<MicroRegiao[]>([]);

  const precisaCidade = cargo === 'VEREADOR' || cargo === 'PREFEITO_VICE';
  const precisaRegiao = cargo === 'DEPUTADO_ESTADUAL' || cargo === 'DEPUTADO_FEDERAL';
  const nacional = cargo === 'PRESIDENTE_VICE';

  useEffect(() => {
    if (!nacional) geoApi.getEstados().then((r) => setEstados(r.data));
  }, [nacional]);

  useEffect(() => {
    if (formData.estado && precisaCidade) {
      geoApi.getCidades(formData.estado).then((r) => setCidades(r.data));
    }
    if (formData.estado && precisaRegiao) {
      geoApi.getMacroRegioes(formData.estado).then((r) => setMacroRegioes(r.data));
    }
  }, [formData.estado]);

  const handleMacroChange = async (macro: MacroRegiao) => {
    const isSelected = (formData.macroRegiao ?? []).includes(macro.nome);
    // Single select: seleciona apenas uma, ou desmarca se já estava selecionada
    const updated = isSelected ? [] : [macro.nome];
    updateFormData({ macroRegiao: updated, microRegiao: [] });
    setMicroRegioes([]);

    if (!isSelected) {
      const r = await geoApi.getMicroRegioes(macro.id);
      setMicroRegioes(r.data);
    }
  };

  const isValid = () => {
    if (nacional) return true;
    if (!formData.estado) return false;
    if (precisaCidade) return !!formData.cidade;
    return true;
  };

  if (nacional) {
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <p className="text-lg text-blue-800 font-medium">
            Sua candidatura abrange todo o território nacional.
          </p>
          <p className="text-blue-600 text-sm mt-2">
            O mapa exibirá dados de todos os estados do Brasil.
          </p>
        </div>
        <div className="flex justify-between pt-4">
          <button type="button" onClick={onBack} className="btn-secondary">← Voltar</button>
          <button type="button" onClick={onNext} className="btn-primary">Avançar →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="label">Estado *</label>
        <select
          value={formData.estado ?? ''}
          onChange={(e) => updateFormData({ estado: e.target.value, cidade: undefined })}
          className="input"
        >
          <option value="">Selecione o estado</option>
          {estados.map((e) => (
            <option key={e.sigla} value={e.sigla}>{e.sigla} — {e.nome}</option>
          ))}
        </select>
      </div>

      {precisaCidade && formData.estado && (
        <div>
          <label className="label">Cidade *</label>
          <select
            value={formData.cidade ?? ''}
            onChange={(e) => updateFormData({ cidade: e.target.value })}
            className="input"
          >
            <option value="">Selecione a cidade</option>
            {cidades.map((c) => (
              <option key={c.id} value={c.nome}>{c.nome}</option>
            ))}
          </select>
        </div>
      )}

      {precisaRegiao && formData.estado && (
        <>
          <div>
            <label className="label">Macrorregião <span className="text-gray-400">(selecione uma)</span></label>
            <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto">
              {macroRegioes.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData.macroRegiao ?? []).includes(m.nome)}
                    onChange={() => handleMacroChange(m)}
                    className="rounded"
                  />
                  {m.nome}
                </label>
              ))}
            </div>
          </div>

          {microRegioes.length > 0 && (
            <div>
              <label className="label">Microrregião <span className="text-gray-400">(selecione uma)</span></label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto">
                {microRegioes.map((m) => {
                  const isChecked = (formData.microRegiao ?? []).includes(m.nome);
                  return (
                    <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          updateFormData({
                            microRegiao: isChecked ? [] : [m.nome],
                          })
                        }
                        className="rounded"
                      />
                      {m.nome}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack} className="btn-secondary">← Voltar</button>
        <button type="button" onClick={onNext} disabled={!isValid()} className="btn-primary disabled:opacity-40">
          Avançar →
        </button>
      </div>
    </div>
  );
}
