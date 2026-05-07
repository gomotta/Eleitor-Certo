import { useCandidateStore } from '@/stores/candidateStore';
import StepperProgress from '@/components/StepperProgress';
import { BrandLogo } from '@/components/Logo';
import Block1Identificacao from './Block1Identificacao';
import Block2Cargo from './Block2Cargo';
import Block3Reduto from './Block3Reduto';
import Block4Bandeiras from './Block4Bandeiras';
import Block5Perfil from './Block5Perfil';
import ConfirmacaoFinal from './ConfirmacaoFinal';

const STEP_LABELS = ['Identificação', 'Cargo', 'Reduto', 'Bandeiras', 'Perfil'];
const TOTAL_STEPS = 5;

const STEP_DESCRIPTIONS: Record<number, { title: string; subtitle: string; icon: string }> = {
  1: { title: 'Identificação', subtitle: 'Seus dados pessoais e do partido', icon: '👤' },
  2: { title: 'Cargo disputado', subtitle: 'Para qual cargo você vai concorrer?', icon: '🏛️' },
  3: { title: 'Reduto eleitoral', subtitle: 'Qual é a sua base geográfica de atuação?', icon: '📍' },
  4: { title: 'Bandeiras', subtitle: 'Escolha as 3 causas centrais da campanha', icon: '🚩' },
  5: { title: 'Perfil de atuação', subtitle: 'Como você prefere agir politicamente?', icon: '🎯' },
  6: { title: 'Revisão final', subtitle: 'Confirme os dados antes de ativar o Copiloto', icon: '✅' },
};

export default function CopilotoPage() {
  const { currentStep, setStep } = useCandidateStore();

  const next = () => setStep(Math.min(currentStep + 1, TOTAL_STEPS + 1));
  const back = () => setStep(Math.max(currentStep - 1, 1));

  const stepInfo = STEP_DESCRIPTIONS[currentStep] ?? STEP_DESCRIPTIONS[1];

  return (
    <div className="min-h-screen bg-white">
      {/* ── Sticky top bar ── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <BrandLogo />
          {currentStep <= TOTAL_STEPS && (
            <span className="text-xs font-medium text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
              Etapa {currentStep} de {TOTAL_STEPS}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-5 pb-8">
        {/* ── Page heading ── */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {currentStep <= TOTAL_STEPS ? 'Configure seu Copiloto' : 'Revisão final'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {currentStep <= TOTAL_STEPS
              ? 'Personalize sua estratégia eleitoral passo a passo'
              : 'Confirme os dados antes de ativar seu assistente'}
          </p>
        </div>

        {/* ── Stepper ── */}
        {currentStep <= TOTAL_STEPS && (
          <StepperProgress
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            labels={STEP_LABELS}
          />
        )}

        {/* ── Step context pill ── */}
        {currentStep <= TOTAL_STEPS && (
          <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
            <span className="text-xl leading-none">{stepInfo.icon}</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{stepInfo.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stepInfo.subtitle}</p>
            </div>
          </div>
        )}

        {/* ── Step card ── */}
        <div className="card p-5 sm:p-7">
          {currentStep === 1 && <Block1Identificacao onNext={next} />}
          {currentStep === 2 && <Block2Cargo onNext={next} onBack={back} />}
          {currentStep === 3 && <Block3Reduto onNext={next} onBack={back} />}
          {currentStep === 4 && <Block4Bandeiras onNext={next} onBack={back} />}
          {currentStep === 5 && <Block5Perfil onNext={next} onBack={back} />}
          {currentStep === 6 && (
            <ConfirmacaoFinal onBack={back} onEditStep={(s) => setStep(s)} />
          )}
        </div>
      </div>
    </div>
  );
}
