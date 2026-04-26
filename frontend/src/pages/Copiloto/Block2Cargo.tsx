import { useCandidateStore } from '@/stores/candidateStore';
import type { Cargo } from '@/types/candidate';

const CARGOS: { value: Cargo; label: string; descricao: string }[] = [
  { value: 'VEREADOR', label: 'Vereador', descricao: 'Câmara Municipal' },
  { value: 'PREFEITO_VICE', label: 'Prefeito / Vice', descricao: 'Prefeitura Municipal' },
  { value: 'DEPUTADO_ESTADUAL', label: 'Deputado Estadual', descricao: 'Assembleia Legislativa' },
  { value: 'DEPUTADO_FEDERAL', label: 'Deputado Federal', descricao: 'Câmara dos Deputados' },
  { value: 'SENADOR', label: 'Senador', descricao: 'Senado Federal' },
  { value: 'GOVERNADOR_VICE', label: 'Governador / Vice', descricao: 'Governo Estadual' },
  { value: 'PRESIDENTE_VICE', label: 'Presidente / Vice', descricao: 'Presidência da República' },
];

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export default function Block2Cargo({ onNext, onBack }: Props) {
  const { formData, updateFormData } = useCandidateStore();
  const selected = formData.cargo;

  const handleSelect = (cargo: Cargo) => {
    updateFormData({ cargo, cidade: undefined, macroRegiao: undefined, microRegiao: undefined });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CARGOS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => handleSelect(c.value)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              selected === c.value
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-primary-300'
            }`}
          >
            <p className="font-semibold text-gray-900">{c.label}</p>
            <p className="text-sm text-gray-500">{c.descricao}</p>
          </button>
        ))}
      </div>

      {!selected && (
        <p className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
          Selecione um cargo para continuar.
        </p>
      )}

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack} className="btn-secondary">← Voltar</button>
        <button type="button" onClick={onNext} disabled={!selected} className="btn-primary disabled:opacity-40">
          Avançar →
        </button>
      </div>
    </div>
  );
}
