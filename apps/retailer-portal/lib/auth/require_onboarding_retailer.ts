import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { type OnboardingStepId, getStepById, ONBOARDING_STEPS } from '@/lib/onboarding/steps';

export type OnboardingRetailer = {
  id: string;
  name: string | null;
  short_description: string | null;
  description: string | null;
  business_type: string | null;
  phone: string | null;
  partner_type: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  onboarding_step: OnboardingStepId;
};

export type OnboardingRetailerContext = {
  userId: string;
  retailer: OnboardingRetailer | null;
};

/**
 * Server-side guard for onboarding step pages.
 *
 * Verifies the session, then loads the partial retailer record (if one exists)
 * so step pages can pre-fill forms. Returns null for `retailer` when no row
 * exists yet (i.e. the user has not completed step 1).
 */
export async function requireOnboardingRetailer(): Promise<OnboardingRetailerContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/sign-in');
  }

  const service = createServiceClient();

  const { data: retailerUser } = await service
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (!retailerUser) {
    return { userId: user.id, retailer: null };
  }

  const { data: retailer } = await service
    .from('retailers')
    .select('id, name, short_description, description, business_type, phone, partner_type, logo_url, cover_image_url, onboarding_step')
    .eq('id', retailerUser.retailer_id)
    .single();

  if (!retailer) {
    return { userId: user.id, retailer: null };
  }

  return {
    userId: user.id,
    retailer: {
      id: retailer.id,
      name: retailer.name,
      short_description: retailer.short_description ?? null,
      description: retailer.description ?? null,
      business_type: retailer.business_type ?? null,
      phone: retailer.phone ?? null,
      partner_type: retailer.partner_type ?? null,
      logo_url: retailer.logo_url ?? null,
      cover_image_url: retailer.cover_image_url ?? null,
      onboarding_step: retailer.onboarding_step as OnboardingStepId,
    },
  };
}

/**
 * Redirects to the retailer's current step if the requested step is ahead of it.
 * Allows backward navigation for editing. Pass in the step ID of the page being
 * rendered and the retailer's persisted step.
 *
 * If the retailer has no row yet, only step 1 (business-details) is accessible.
 */
export function guardOnboardingStep(
  requestedStepId: OnboardingStepId,
  currentStepId: OnboardingStepId | null,
): void {
  const effectiveCurrent = currentStepId ?? 'business-details';
  const requested = getStepById(requestedStepId);
  const current = getStepById(effectiveCurrent);

  if (!requested || !current) return;

  if (requested.number > current.number) {
    redirect(current.path);
  }
}

/**
 * Returns the step that comes after the given step, or the last step if none.
 */
export function nextStepId(stepId: OnboardingStepId): OnboardingStepId {
  const step = getStepById(stepId);
  if (!step) return stepId;
  const next = ONBOARDING_STEPS.find((s) => s.number === step.number + 1);
  return next ? next.id : stepId;
}
