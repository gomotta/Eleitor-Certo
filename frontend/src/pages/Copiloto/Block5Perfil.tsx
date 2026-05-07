import { useCandidateStore } from '@/stores/candidateStore';

const PERFIS = [
  { label: 'Político tradicional',         emoji: '🏛️' },
  { label: 'Técnico / Gestor Público',      emoji: '📊' },
  { label: 'Empresarial',                   emoji: '💼' },
  { label: 'Comunitário / Liderança Local', emoji: '🤝' },
  { label: 'Religioso',                     emoji: '✝️' },
  { label: 'Sindical / Classista',          emoji: '👷' },
  { label: 'Midiático / Comunicador',       emoji: '📢' },
  { label: 'Acadêmico / Intelectual',       emoji: '🎓' },
  { label: 'Esportivo / Cultural',          emoji: '🏆' },
  { label: 'Ativista / Causa específica',   emoji: '✊' },
  { label: 'Segurança Pública',             emoji: '🛡️' },
  { label: 'Saúde',                         emoji: '🏥' },
  { label: 'Jurídico',                      emoji: '⚖️' },
  { label: 'Jovem / Renovação',             emoji: '🌱' },
];

interface Props {
  onNext: () => void;
  onBack: () => void;
}

export default function Block5Perfil({ onNext, onBack }: Props) {
  const { formData, updateFormData } = useCandidateStore();
  const selected = formData.perfilAtuacao;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">Qual perfil melhor representa sua atuação política?</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PERFIS.map(({ label, emoji }) => {
          const isSelected = selected === label;
          return (
            <button
              key={label}
              type="button"
              onClick={() => updateFormData({ perfilAtuacao: label })}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-150 ${
                isSelected
                  ? 'border-primary-500 bg-primary-50 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-primary-200 hover:bg-primary-50/30'
              }`}
            >
              {/* Radio dot */}
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                isSelected ? 'border-primary-500' : 'border-gray-300'
              }`}>
                {isSelected && (
                  <div className="w-2 h-2 rounded-full bg-primary-500" />
                )}
              </div>

              <span className="text-lg leading-none flex-shrink-0">{emoji}</span>

              <span className={`text-sm font-medium ${isSelected ? 'text-primary-800' : 'text-gray-700'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {!selected && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 px-4 py-2.5 rounded-lg">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Selecione um perfil para continuar.
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="btn-secondary">
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <button type="button" onClick={onNext} disabled={!selected} className="btn-primary disabled:opacity-40">
          Revisar
          <svg className="w-4 h-4 ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
