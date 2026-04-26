import { useCandidateStore } from '@/stores/candidateStore';

const PERFIS = [
  'Político tradicional',
  'Técnico / Gestor Público',
  'Empresarial',
  'Comunitário / Liderança Local',
  'Religioso',
  'Sindical / Classista',
  'Midiático / Comunicador',
  'Acadêmico / Intelectual',
  'Esportivo / Cultural',
  'Ativista / Causa específica',
  'Segurança Pública',
  'Saúde',
  'Jurídico',
  'Jovem / Renovação',
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
      <p className="text-sm text-gray-600">Qual perfil melhor representa sua atuação política?</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {PERFIS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => updateFormData({ perfilAtuacao: p })}
            className={`text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
              selected === p
                ? 'border-primary-500 bg-primary-50 text-primary-800'
                : 'border-gray-200 hover:border-primary-300 text-gray-700'
            }`}
          >
            {selected === p && <span className="mr-2 text-primary-500">✓</span>}
            {p}
          </button>
        ))}
      </div>

      {!selected && (
        <p className="text-sm text-amber-600 bg-amber-50 px-4 py-2 rounded-lg">
          Selecione um perfil para continuar.
        </p>
      )}

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack} className="btn-secondary">← Voltar</button>
        <button type="button" onClick={onNext} disabled={!selected} className="btn-primary disabled:opacity-40">
          Revisar →
        </button>
      </div>
    </div>
  );
}
