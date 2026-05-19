'use client';

import { usePathname, useRouter } from 'next/navigation';
import { getStepByPath, getNextStep, getPrevStep } from '@/lib/onboarding/steps';

/**
 * Footer navigation for the onboarding flow.
 *
 * In the scaffolding phase, Continue simply navigates to the next step.
 * In full implementation, Continue will first trigger the current step's
 * form submission (via a server action) before navigating.
 *
 * The `submitted` step renders no footer — the confirmation screen has its
 * own call to action.
 */
export function OnboardingNav() {
  const pathname = usePathname();
  const router = useRouter();

  const currentStep = getStepByPath(pathname);
  if (!currentStep || currentStep.id === 'submitted') return null;

  const prevStep = getPrevStep(currentStep.id);
  const nextStep = getNextStep(currentStep.id);

  // The preview step submits for review instead of continuing to a form.
  const isPreview = currentStep.id === 'preview';
  const continueLabel = isPreview ? 'Submit for review' : 'Continue';

  const handleBack = () => {
    if (prevStep) router.push(prevStep.path);
  };

  const handleContinue = () => {
    if (nextStep) router.push(nextStep.path);
  };

  return (
    <footer className="border-t border-gray-100 bg-white px-6 py-4">
      <div className="mx-auto flex max-w-xl items-center justify-between">
        {prevStep ? (
          <button
            onClick={handleBack}
            className="text-sm font-medium text-gray-400 transition-colors hover:text-gray-600"
          >
            ← Back
          </button>
        ) : (
          <div />
        )}

        <button
          onClick={handleContinue}
          className={[
            'rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity',
            'bg-brand hover:opacity-90',
            !nextStep ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
          disabled={!nextStep}
        >
          {continueLabel}
        </button>
      </div>
    </footer>
  );
}
