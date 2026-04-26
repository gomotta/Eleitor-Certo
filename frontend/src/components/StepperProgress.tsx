interface Props {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

export default function StepperProgress({ currentStep, totalSteps, labels }: Props) {
  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between relative">
        {/* Track */}
        <div className="absolute top-[18px] left-0 right-0 h-0.5 bg-gray-100 z-0" />
        {/* Fill */}
        <div
          className="absolute top-[18px] left-0 h-0.5 bg-primary-500 z-0 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />

        {labels.map((label, i) => {
          const step = i + 1;
          const done = step < currentStep;
          const active = step === currentStep;
          return (
            <div key={step} className="flex flex-col items-center z-10">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  done
                    ? 'bg-primary-600 text-white shadow-sm shadow-primary-200'
                    : active
                      ? 'bg-white text-primary-600 border-2 border-primary-500 shadow-sm shadow-primary-100'
                      : 'bg-white text-gray-400 border-2 border-gray-200'
                }`}
              >
                {done ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : step}
              </div>
              <span
                className={`mt-2 text-xs font-medium transition-colors duration-300 ${
                  active ? 'text-primary-600' : done ? 'text-gray-500' : 'text-gray-300'
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="h-1 flex-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="ml-3 text-xs text-gray-400 font-medium shrink-0">
          {currentStep}/{totalSteps}
        </span>
      </div>
    </div>
  );
}
