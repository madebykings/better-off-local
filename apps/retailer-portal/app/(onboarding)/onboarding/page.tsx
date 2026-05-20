import { redirect } from 'next/navigation';
import { requireOnboardingRetailer } from '@/lib/auth/require_onboarding_retailer';
import { getStepById } from '@/lib/onboarding/steps';

/**
 * /onboarding index — resumes the retailer at their persisted step.
 *
 * New users (no retailer row yet) land on step 1. Returning users are sent
 * directly to whichever step they last reached so they can pick up where
 * they left off.
 */
export default async function OnboardingIndexPage() {
  const { retailer } = await requireOnboardingRetailer();

  const stepId = retailer?.onboarding_step ?? 'business-details';
  const step = getStepById(stepId);

  redirect(step?.path ?? '/onboarding/business-details');
}
