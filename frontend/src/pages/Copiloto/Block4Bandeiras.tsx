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
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Selecione exatamente 3 bandeiras da sua campanha.</p>
        <span
          className={`text-sm font-bold px-3 py-1 rounded-full ${
            isComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {selected.length} de {MAX} selecionadas
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {BANDEIRAS.map((b) => {
          const checked = selected.includes(b);
          const disabled = !checked && selected.length >= MAX;
          return (
            <button
              key={b}
              type="button"
              onClick={() => toggle(b)}
              disabled={disabled}
              className={`text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                checked
                  ? 'border-primary-500 bg-primary-50 text-primary-800'
                  : disabled
                    ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                    : 'border-gray-200 hover:border-primary-300 text-gray-700'
              }`}
            >
              {checked && <span className="mr-2 text-primary-500">✓</span>}
              {b}
            </button>
          );
        })}
      </div>

      {!isComplete && (
        <p className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
          Selecione exatamente {MAX} bandeiras para continuar.
        </p>
      )}

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack} className="btn-secondary">← Voltar</button>
        <button type="button" onClick={onNext} disabled={!isComplete} className="btn-primary disabled:opacity-40">
          Avançar →
        </button>
      </div>
    </div>
  );
}
