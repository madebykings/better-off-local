'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import {
  getStepByPath,
  getNextStep,
  getPrevStep,
  FORM_CONTROLLED_STEPS,
} from '@/lib/onboarding/steps';
import { advanceOnboardingStep, submitForReview } from '@/lib/actions/onboarding';

/**
 * Footer navigation for the onboarding flow.
 *
 * For non-form steps, Continue calls `advanceOnboardingStep` to persist
 * progress before navigating, so the retailer resumes at the correct step
 * if they leave and return. For the preview step, Continue calls
 * `submitForReview` instead.
 *
 * Form-controlled steps (e.g. business-details) own their own Back/Continue
 * and call `saveBusinessDetails` directly — OnboardingNav renders null for them.
 */
export function OnboardingNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const currentStep = getStepByPath(pathname);
  // submitted: has its own CTA. form-controlled: form owns back/continue.
  if (!currentStep || currentStep.id === 'submitted') return null;
  if (FORM_CONTROLLED_STEPS.has(currentStep.id)) return null;

  const prevStep = getPrevStep(currentStep.id);
  const nextStep = getNextStep(currentStep.id);
  const isPreview = currentStep.id === 'preview';
  const continueLabel = isPreview ? 'Submit for review' : 'Continue';

  const handleBack = () => {
    if (prevStep) router.push(prevStep.path);
  };

  const handleContinue = () => {
    if (!nextStep) return;
    startTransition(async () => {
      if (isPreview) {
        const result = await submitForReview();
        if (result?.error) {
          // Submission failed — stay on the page.
          // Error surfacing can be improved once the preview page has a form component.
          console.error('[OnboardingNav] submitForReview error:', result.error);
          return;
        }
      } else {
        await advanceOnboardingStep(currentStep.id);
      }
      router.push(nextStep.path);
    });
  };

  return (
    <footer className="border-t border-gray-100 bg-white px-6 py-4">
      <div className="mx-auto flex max-w-xl items-center justify-between">
        {prevStep ? (
          <button
            onClick={handleBack}
            disabled={isPending}
            className="text-sm font-medium text-gray-400 transition-colors hover:text-gray-600 disabled:opacity-50"
          >
            ← Back
          </button>
        ) : (
          <div />
        )}

        <button
          onClick={handleContinue}
          disabled={!nextStep || isPending}
          className={[
            'rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-opacity',
            'bg-brand hover:opacity-90',
            !nextStep || isPending ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {isPending ? 'Saving…' : continueLabel}
        </button>
      </div>
    </footer>
  );
}
