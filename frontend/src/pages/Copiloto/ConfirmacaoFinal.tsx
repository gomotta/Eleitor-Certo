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

const STEP_ICONS: Record<number, string> = {
  1: '👤', 2: '🏛️', 3: '📍', 4: '🚩', 5: '🎯',
};

interface Props {
  onBack: () => void;
  onEditStep: (step: number) => void;
}

function Section({
  title,
  step,
  children,
  onEdit,
}: {
  title: string;
  step: number;
  children: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <span className="text-base leading-none">{STEP_ICONS[step]}</span>
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Editar
        </button>
      </div>
      <div className="px-4 py-3.5 space-y-1.5">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-gray-400 shrink-0">{label}:</span>
      <span className="text-gray-800 font-medium">{value || '—'}</span>
    </div>
  );
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
      navigate('/dashboard');
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ??
        err?.response?.data?.details ??
        'Erro ao salvar. Verifique os dados e tente novamente.';
      setError(typeof msg === 'object' ? JSON.stringify(msg) : msg);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Revise todas as informações antes de ativar o Copiloto.
      </p>

      <Section title="Identificação" step={1} onEdit={() => onEditStep(1)}>
        <Row label="Nome completo" value={formData.nomeCompleto} />
        <Row label="Nome de urna" value={formData.nomeUrna} />
        <Row label="Partido" value={`${formData.partidoSigla} — ${formData.partidoNome}`} />
<Row label="Telefone" value={formData.telefone} />
      </Section>

      <Section title="Cargo disputado" step={2} onEdit={() => onEditStep(2)}>
        <Row label="Cargo" value={CARGO_LABELS[formData.cargo ?? '']} />
      </Section>

      <Section title="Reduto Eleitoral" step={3} onEdit={() => onEditStep(3)}>
        <Row label="Estado" value={formData.estado} />
        {(formData.macroRegiao ?? []).length > 0 && (
          <Row label="Macrorregião" value={(formData.macroRegiao ?? []).join(', ')} />
        )}
        {(formData.microRegiao ?? []).length > 0 && (
          <Row label="Microrregião" value={(formData.microRegiao ?? []).join(', ')} />
        )}
      </Section>

      <Section title="Bandeiras" step={4} onEdit={() => onEditStep(4)}>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {(formData.bandeiras ?? []).map((b) => (
            <span
              key={b}
              className="inline-flex items-center gap-1 bg-primary-600 text-white text-xs font-medium px-3 py-1 rounded-full"
            >
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {b}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Perfil de Atuação" step={5} onEdit={() => onEditStep(5)}>
        <Row label="Perfil" value={formData.perfilAtuacao} />
      </Section>

      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex justify-between pt-3">
        <button type="button" onClick={onBack} className="btn-secondary">
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Voltar
        </button>
        <button
          type="button"
          onClick={handleAtivate}
          disabled={loading}
          className="btn-primary bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-6 gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Ativando…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Ativar Copiloto
            </>
          )}
        </button>
      </div>
    </div>
  );
}
