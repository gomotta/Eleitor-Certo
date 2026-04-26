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

const STEP_DESCRIPTIONS: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'Identificação', subtitle: 'Seus dados pessoais e do seu partido' },
  2: { title: 'Cargo disputado', subtitle: 'Para qual cargo você vai concorrer?' },
  3: { title: 'Reduto eleitoral', subtitle: 'Qual é a sua base geográfica de atuação?' },
  4: { title: 'Bandeiras', subtitle: 'Escolha as 3 causas centrais da sua campanha' },
  5: { title: 'Perfil de atuação', subtitle: 'Como você prefere agir politicamente?' },
  6: { title: 'Revisão final', subtitle: 'Confirme os dados antes de ativar seu Copiloto' },
};

export default function CopilotoPage() {
  const { currentStep, setStep } = useCandidateStore();

  const next = () => setStep(Math.min(currentStep + 1, TOTAL_STEPS + 1));
  const back = () => setStep(Math.max(currentStep - 1, 1));

  const stepInfo = STEP_DESCRIPTIONS[currentStep] ?? STEP_DESCRIPTIONS[1];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50/30 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <BrandLogo className="mb-3" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {currentStep <= TOTAL_STEPS ? 'Configure seu Copiloto' : 'Tudo certo!'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {currentStep <= TOTAL_STEPS
                ? 'Personalize sua estratégia de campanha passo a passo'
                : 'Revise e ative seu assistente inteligente de campanha'}
            </p>
          </div>
        </div>

        {currentStep <= TOTAL_STEPS && (
          <StepperProgress
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            labels={STEP_LABELS}
          />
        )}

        {/* Step context */}
        {currentStep <= TOTAL_STEPS && (
          <div className="mb-4 flex items-center gap-2">
            <div className="w-1 h-8 rounded-full bg-primary-500" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{stepInfo.title}</p>
              <p className="text-xs text-gray-400">{stepInfo.subtitle}</p>
            </div>
          </div>
        )}

        <div className="card p-6 sm:p-8">
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
