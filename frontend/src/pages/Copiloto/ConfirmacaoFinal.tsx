import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCandidateStore } from '@/stores/candidateStore';
import { candidateApi } from '@/services/api/candidate';

const CARGO_LABELS: Record<string, string> = {
  VEREADOR: 'Vereador',
  PREFEITO_VICE: 'Prefeito / Vice',
  DEPUTADO_ESTADUAL: 'Deputado Estadual',
  DEPUTADO_FEDERAL: 'Deputado Federal',
  SENADOR: 'Senador',
  GOVERNADOR_VICE: 'Governador / Vice',
  PRESIDENTE_VICE: 'Presidente / Vice',
};

interface Props {
  onBack: () => void;
  onEditStep: (step: number) => void;
}

export default function ConfirmacaoFinal({ onBack, onEditStep }: Props) {
  const navigate = useNavigate();
  const { formData, setCandidateId, activateCopiloto } = useCandidateStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAtivate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await candidateApi.save(formData as any);
      setCandidateId(res.data.id);
      activateCopiloto();
      navigate('/mapa');
    } catch (err: any) {
      const msg = err?.response?.data?.error
        ?? err?.response?.data?.details
        ?? 'Erro ao salvar. Verifique os dados e tente novamente.';
      setError(typeof msg === 'object' ? JSON.stringify(msg) : msg);
      setLoading(false);
    }
  };

  const Section = ({
    title,
    step,
    children,
  }: {
    title: string;
    step: number;
    children: React.ReactNode;
  }) => (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <button
          type="button"
          onClick={() => onEditStep(step)}
          className="text-primary-600 text-sm font-medium hover:underline"
        >
          Editar
        </button>
      </div>
      {children}
    </div>
  );

  const Row = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="text-sm">
      <span className="text-gray-500">{label}: </span>
      <span className="text-gray-900 font-medium">{value || '—'}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-gray-600 text-sm">Confira seus dados antes de ativar o Copiloto.</p>

      <Section title="Bloco 1 — Identificação" step={1}>
        <div className="space-y-1">
          <Row label="Nome completo" value={formData.nomeCompleto} />
          <Row label="Nome de urna" value={formData.nomeUrna} />
          <Row label="Partido" value={`${formData.partidoSigla} — ${formData.partidoNome}`} />
          <Row label="E-mail" value={formData.emailContato} />
          <Row label="Telefone" value={formData.telefone} />
        </div>
      </Section>

      <Section title="Bloco 2 — Cargo" step={2}>
        <Row label="Cargo" value={CARGO_LABELS[formData.cargo ?? '']} />
      </Section>

      <Section title="Bloco 3 — Reduto Eleitoral" step={3}>
        <div className="space-y-1">
          <Row label="Estado" value={formData.estado} />
          <Row label="Cidade" value={formData.cidade} />
          {formData.macroRegiao && formData.macroRegiao.length > 0 && (
            <Row label="Macrorregiões" value={formData.macroRegiao.join(', ')} />
          )}
        </div>
      </Section>

      <Section title="Bloco 4 — Bandeiras" step={4}>
        <div className="flex flex-wrap gap-2">
          {(formData.bandeiras ?? []).map((b) => (
            <span key={b} className="bg-primary-100 text-primary-800 text-xs px-3 py-1 rounded-full font-medium">
              {b}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Bloco 5 — Perfil de Atuação" step={5}>
        <Row label="Perfil" value={formData.perfilAtuacao} />
      </Section>

      {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>}

      <div className="flex justify-between pt-4">
        <button type="button" onClick={onBack} className="btn-secondary">← Voltar</button>
        <button
          type="button"
          onClick={handleAtivate}
          disabled={loading}
          className="btn-primary bg-green-600 hover:bg-green-700 disabled:opacity-50 px-8"
        >
          {loading ? 'Ativando...' : '🚀 Ativar Copiloto'}
        </button>
      </div>
    </div>
  );
}
