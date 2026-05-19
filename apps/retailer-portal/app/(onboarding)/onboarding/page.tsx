import { redirect } from 'next/navigation';
import { requireOnboardingUser } from '@/lib/auth/require_onboarding_user';
import { ONBOARDING_STEPS } from '@/lib/onboarding/steps';

/**
 * /onboarding index — redirects to the retailer's current step.
 *
 * TODO: once onboarding progress is persisted (e.g. retailers.onboarding_step),
 * read that value here and redirect to the appropriate step path instead of
 * always redirecting to step 1.
 */
export default async function OnboardingIndexPage() {
  await requireOnboardingUser();

  // Always land on the first step for now.
  redirect(ONBOARDING_STEPS[0].path);
}
