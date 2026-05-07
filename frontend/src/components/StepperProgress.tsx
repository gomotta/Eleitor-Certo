interface Props {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

export default function StepperProgress({ currentStep, totalSteps, labels }: Props) {
  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="w-full mb-4">
      <div className="flex items-start justify-between relative">
        {/* Track line */}
        <div className="absolute top-[17px] left-4 right-4 h-px bg-gray-150 z-0"
             style={{ backgroundColor: '#e5e7eb' }} />
        {/* Progress fill */}
        <div
          className="absolute top-[17px] left-4 h-px bg-primary-500 z-0 transition-all duration-500 ease-out"
          style={{ width: `calc(${progress}% * (100% - 2rem) / 100)` }}
        />

        {labels.map((label, i) => {
          const step = i + 1;
          const done = step < currentStep;
          const active = step === currentStep;

          return (
            <div key={step} className="flex flex-col items-center z-10 min-w-0" style={{ flex: '1 1 0' }}>
              {/* Circle */}
              <div
                className={`w-[34px] h-[34px] rounded-full flex items-center justify-center text-xs font-bold
                             border-2 transition-all duration-300 ${
                  done
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : active
                      ? 'bg-white border-primary-500 text-primary-600 shadow-sm shadow-primary-100 ring-4 ring-primary-50'
                      : 'bg-white border-gray-200 text-gray-400'
                }`}
              >
                {done ? (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step
                )}
              </div>

              {/* Label */}
              <span
                className={`mt-2 text-[11px] font-medium text-center leading-tight transition-colors duration-300 px-0.5 ${
                  active ? 'text-primary-600' : done ? 'text-gray-500' : 'text-gray-300'
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
