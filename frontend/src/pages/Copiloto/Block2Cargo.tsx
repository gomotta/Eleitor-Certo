import { useCandidateStore } from '@/stores/candidateStore';
import type { Cargo } from '@/types/candidate';

const CARGOS: { value: Cargo; label: string; descricao: string }[] = [
  { value: 'VEREADOR',          label: 'Vereador',          descricao: 'Câmara Municipal'           },
  { value: 'PREFEITO_VICE',     label: 'Prefeito / Vice',   descricao: 'Prefeitura Municipal'        },
  { value: 'DEPUTADO_ESTADUAL', label: 'Dep. Estadual',     descricao: 'Assembleia Legislativa'      },
  { value: 'DEPUTADO_FEDERAL',  label: 'Dep. Federal',      descricao: 'Câmara dos Deputados'        },
  { value: 'SENADOR',           label: 'Senador',           descricao: 'Senado Federal'              },
  { value: 'GOVERNADOR_VICE',   label: 'Governador / Vice', descricao: 'Governo Estadual'            },
  { value: 'PRESIDENTE_VICE',   label: 'Presidente / Vice', descricao: 'Presidência da República'   },
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
    <div className="space-y-5">
      <p className="text-sm text-gray-500">Selecione o cargo que você vai disputar na eleição.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {CARGOS.map((c) => {
          const isSelected = selected === c.value;
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => handleSelect(c.value)}
              className={`flex items-center gap-3.5 p-4 rounded-xl border-2 text-left transition-all duration-150 ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-primary-200 hover:bg-primary-50/30'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${isSelected ? 'text-primary-800' : 'text-gray-900'}`}>
                  {c.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{c.descricao}</p>
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {!selected && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 px-4 py-2.5 rounded-lg">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Selecione um cargo para continuar.
        </div>
      )}

      <div className="flex justify-between pt-3 mt-1">
        <button type="button" onClick={onBack} className="btn-secondary">
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <button type="button" onClick={onNext} disabled={!selected} className="btn-primary disabled:opacity-40">
          Avançar
          <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
