'use client';

import { usePathname } from 'next/navigation';
import { ONBOARDING_STEPS, TOTAL_STEPS, getStepByPath } from '@/lib/onboarding/steps';

export function OnboardingProgress() {
  const pathname = usePathname();
  const currentStep = getStepByPath(pathname);
  const currentNumber = currentStep?.number ?? 1;

  return (
    <div className="border-b border-gray-100 bg-white px-6 py-3">
      {/* Segmented bar */}
      <div className="flex gap-1">
        {ONBOARDING_STEPS.map((step) => {
          const isComplete = step.number < currentNumber;
          const isActive = step.number === currentNumber;
          return (
            <div
              key={step.id}
              className={[
                'h-1 flex-1 rounded-full transition-colors duration-300',
                isComplete ? 'bg-brand' : isActive ? 'bg-brand/40' : 'bg-gray-200',
              ].join(' ')}
              aria-label={step.label}
            />
          );
        })}
      </div>

      {/* Step counter */}
      <p className="mt-2 text-xs text-gray-400">
        Step {currentNumber} of {TOTAL_STEPS}
        {currentStep && (
          <span className="ml-1 font-medium text-gray-600">
            — {currentStep.label}
          </span>
        )}
      </p>
    </div>
  );
}
