import { useCandidateStore } from '@/stores/candidateStore';

const BANDEIRAS = [
  'Saúde',
  'Educação',
  'Segurança pública',
  'Economia e emprego',
  'Infraestrutura e mobilidade',
  'Desenvolvimento urbano e habitação',
  'Desenvolvimento rural e agronegócio',
  'Meio ambiente e sustentabilidade',
  'Assistência social e combate à pobreza',
  'Cultura, esporte e lazer',
  'Ciência, tecnologia e inovação',
  'Direitos e cidadania',
  'Gestão pública e combate à corrupção',
  'Tributação e reforma do Estado',
  'Família e valores',
  'Juventude',
  'Mulheres',
  'Pessoa idosa',
  'Pessoas com deficiência',
  'Defesa e soberania',
];

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export default function Block4Bandeiras({ onNext, onBack }: Props) {
  const { formData, updateFormData } = useCandidateStore();
  const selected = formData.bandeiras ?? [];
  const MAX = 3;

  const toggle = (bandeira: string) => {
    if (selected.includes(bandeira)) {
      updateFormData({ bandeiras: selected.filter((b) => b !== bandeira) });
    } else if (selected.length < MAX) {
      updateFormData({ bandeiras: [...selected, bandeira] });
    }
  };

  const isComplete = selected.length === MAX;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Selecione exatamente 3 bandeiras da campanha.</p>
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
            isComplete
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {isComplete && (
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          {selected.length}/{MAX}
        </span>
      </div>

      {/* Tags grid */}
      <div className="flex flex-wrap gap-2">
        {BANDEIRAS.map((b) => {
          const checked = selected.includes(b);
          const disabled = !checked && selected.length >= MAX;
          return (
            <button
              key={b}
              type="button"
              onClick={() => toggle(b)}
              disabled={disabled}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium
                          border transition-all duration-150 ${
                checked
                  ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                  : disabled
                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300 hover:bg-primary-50/60 hover:text-primary-700'
              }`}
            >
              {checked && (
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {b}
            </button>
          );
        })}
      </div>

      {/* Selected preview */}
      {selected.length > 0 && !isComplete && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 px-4 py-2.5 rounded-lg">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Selecione mais {MAX - selected.length} bandeira{MAX - selected.length > 1 ? 's' : ''} para continuar.
        </div>
      )}

      {selected.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 px-4 py-2.5 rounded-lg">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Selecione exatamente {MAX} bandeiras para continuar.
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="btn-secondary">
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <button type="button" onClick={onNext} disabled={!isComplete} className="btn-primary disabled:opacity-40">
          Avançar
          <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
