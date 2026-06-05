'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { type OnboardingStepId, getStepById, ONBOARDING_STEPS } from '@/lib/onboarding/steps';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusinessDetailsFields {
  name: string;
  shortDescription: string; // → retailers.short_description
  businessType: string;
  phone: string;
  partnerType: string;
}

export interface BusinessDetailsActionResult {
  error?: string;
  fieldErrors?: Partial<Record<keyof BusinessDetailsFields, string>>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateBusinessDetails(
  fields: BusinessDetailsFields,
): Partial<Record<keyof BusinessDetailsFields, string>> {
  const errors: Partial<Record<keyof BusinessDetailsFields, string>> = {};
  if (fields.name.trim().length < 2) {
    errors.name = 'Business name is required (at least 2 characters).';
  }
  if (fields.shortDescription.trim().length < 10) {
    errors.shortDescription = 'Short description must be at least 10 characters.';
  }
  if (fields.shortDescription.trim().length > 160) {
    errors.shortDescription = 'Short description must be 160 characters or fewer.';
  }
  if (!fields.businessType) {
    errors.businessType = 'Please select a business type.';
  }
  return errors;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateSlug(name: string): string {
  const base = slugify(name) || 'retailer';
  // Append a short random suffix so slugs never collide on creation.
  const suffix = crypto.randomUUID().slice(0, 8);
  return `${base}-${suffix}`;
}

/** Returns the authenticated user ID or redirects to sign-in. */
async function getAuthUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/sign-in');
  return user.id;
}

/** Looks up the retailer ID for the current user. Returns null if none exists. */
async function getRetailerId(userId: string): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', userId)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

/**
 * Returns the next onboarding step ID after `stepId`, or `stepId` itself if
 * there is no further step.
 */
function nextStep(stepId: OnboardingStepId): OnboardingStepId {
  const current = getStepById(stepId);
  if (!current) return stepId;
  const next = (ONBOARDING_STEPS as readonly { number: number; id: OnboardingStepId }[]).find(
    (s) => s.number === current.number + 1,
  );
  return next?.id ?? stepId;
}

// ---------------------------------------------------------------------------
// Business Details — full save (advances onboarding_step)
// ---------------------------------------------------------------------------

/**
 * Validates and persists the business details step.
 *
 * On first call: creates the `retailers` row and links it to the user via
 * `retailer_users`. Sets `onboarding_step = 'branding'`.
 *
 * On subsequent calls: updates the existing row. Only advances
 * `onboarding_step` if the retailer is still on `business-details` (prevents
 * regressing progress when the user returns to edit).
 *
 * Returns null on success. Returns { fieldErrors } or { error } on failure.
 */
export async function saveBusinessDetails(
  fields: BusinessDetailsFields,
): Promise<BusinessDetailsActionResult | null> {
  const fieldErrors = validateBusinessDetails(fields);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const userId = await getAuthUserId();
  const service = createServiceClient();

  const existingRetailerId = await getRetailerId(userId);

  if (existingRetailerId) {
    // Update — only advance the step if still on step 1.
    const { data: current } = await service
      .from('retailers')
      .select('onboarding_step')
      .eq('id', existingRetailerId)
      .single();

    const shouldAdvance = current?.onboarding_step === 'business-details';

    const { error } = await service
      .from('retailers')
      .update({
        name: fields.name.trim(),
        short_description: fields.shortDescription.trim(),
        business_type: fields.businessType || null,
        phone: fields.phone.trim() || null,
        partner_type: fields.partnerType || 'business',
        ...(shouldAdvance ? { onboarding_step: 'branding' } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRetailerId);

    if (error) {
      console.error('[saveBusinessDetails] update error:', error.message);
      return { error: 'Failed to save. Please try again.' };
    }
  } else {
    // Create retailer + retailer_user.
    const slug = generateSlug(fields.name.trim());

    const { data: newRetailer, error: insertError } = await service
      .from('retailers')
      .insert({
        name: fields.name.trim(),
        slug,
        short_description: fields.shortDescription.trim(),
        business_type: fields.businessType || null,
        phone: fields.phone.trim() || null,
        partner_type: fields.partnerType || 'business',
        onboarding_step: 'branding',
      })
      .select('id')
      .single();

    if (insertError || !newRetailer) {
      console.error('[saveBusinessDetails] insert error:', insertError?.message);
      return { error: 'Failed to save. Please try again.' };
    }

    const { error: userError } = await service.from('retailer_users').insert({
      retailer_id: newRetailer.id,
      profile_id: userId,
      access_role: 'owner',
      is_active: true,
    });

    if (userError) {
      console.error('[saveBusinessDetails] retailer_user insert error:', userError.message);
      return { error: 'Failed to save. Please try again.' };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Business Details — draft save (does NOT advance onboarding_step)
// ---------------------------------------------------------------------------

/**
 * Persists a partial draft of the business details form without advancing
 * `onboarding_step`. Called by the autosave debounce in the form component.
 *
 * Creates the retailer row on first autosave if the name is long enough.
 * Silent no-op if the row does not exist and the name is too short.
 */
export async function draftSaveBusinessDetails(
  fields: BusinessDetailsFields,
): Promise<void> {
  if (fields.name.trim().length < 2) return;

  const userId = await getAuthUserId();
  const service = createServiceClient();

  const existingRetailerId = await getRetailerId(userId);

  if (existingRetailerId) {
    await service
      .from('retailers')
      .update({
        name: fields.name.trim(),
        short_description: fields.shortDescription.trim() || null,
        business_type: fields.businessType || null,
        phone: fields.phone.trim() || null,
        partner_type: fields.partnerType || 'business',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingRetailerId);
  } else {
    // First autosave — create the row so progress is not lost.
    // TODO: these two inserts are not atomic. If the retailer_users insert
    // fails, the retailers row is orphaned (invisible to future page loads
    // which query via retailer_users). Low probability with service-role
    // writes but could accumulate ghost rows. Fix with a Postgres RPC that
    // wraps both inserts in a transaction.
    //
    // TODO: concurrent autosave calls (e.g. two browser tabs) that both find
    // getRetailerId = null could each insert a retailers row before the other's
    // retailer_users row is visible, creating duplicate retailers for the same
    // user. The 12s debounce makes this negligible in practice.
    const slug = generateSlug(fields.name.trim());

    const { data: newRetailer } = await service
      .from('retailers')
      .insert({
        name: fields.name.trim(),
        slug,
        short_description: fields.shortDescription.trim() || null,
        business_type: fields.businessType || null,
        phone: fields.phone.trim() || null,
        partner_type: fields.partnerType || 'business',
        onboarding_step: 'business-details',
      })
      .select('id')
      .single();

    if (newRetailer) {
      await service.from('retailer_users').insert({
        retailer_id: newRetailer.id,
        profile_id: userId,
        access_role: 'owner',
        is_active: true,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Advance step (used by OnboardingNav for non-form steps)
// ---------------------------------------------------------------------------

/**
 * Advances `onboarding_step` to the step after `currentStepId`, but only if
 * the retailer is currently on `currentStepId`. This prevents the nav from
 * regressing progress when a user goes back to a previous step and clicks
 * Continue again.
 *
 * Silent no-op if no retailer row exists.
 */
export async function advanceOnboardingStep(
  currentStepId: OnboardingStepId,
): Promise<void> {
  const userId = await getAuthUserId();
  const retailerId = await getRetailerId(userId);
  if (!retailerId) return;

  const service = createServiceClient();

  const { data } = await service
    .from('retailers')
    .select('onboarding_step')
    .eq('id', retailerId)
    .single();

  if (data?.onboarding_step !== currentStepId) return;

  const next = nextStep(currentStepId);
  if (next === currentStepId) return;

  await service
    .from('retailers')
    .update({ onboarding_step: next, updated_at: new Date().toISOString() })
    .eq('id', retailerId);
}

// ---------------------------------------------------------------------------
// Submit for review
// ---------------------------------------------------------------------------

/**
 * Marks the retailer application as ready for admin review.
 * Sets `approval_status = 'pending'` and `onboarding_step = 'submitted'`.
 *
 * Server-side guard: rejects submissions from retailers that have not yet
 * reached the preview step. UI route guards are not sufficient because
 * server actions are callable directly.
 *
 * Idempotent: calling again after already submitting returns success.
 *
 * Returns null on success, { error } on failure.
 */
export async function submitForReview(): Promise<{ error: string } | null> {
  const userId = await getAuthUserId();
  const retailerId = await getRetailerId(userId);

  if (!retailerId) {
    return { error: 'No retailer record found. Please complete the previous steps.' };
  }

  const service = createServiceClient();

  const { data: retailer } = await service
    .from('retailers')
    .select('onboarding_step')
    .eq('id', retailerId)
    .single();

  if (!retailer) {
    return { error: 'Retailer record not found. Please try again.' };
  }

  // Idempotent: already submitted — treat as success.
  if (retailer.onboarding_step === 'submitted') {
    return null;
  }

  // Must have reached the preview step before submitting.
  const step = getStepById(retailer.onboarding_step as OnboardingStepId);
  const previewStep = getStepById('preview');
  if (!step || !previewStep || step.number < previewStep.number) {
    return { error: 'Please complete all steps before submitting for review.' };
  }

  const { error } = await service
    .from('retailers')
    .update({
      approval_status: 'pending',
      onboarding_step: 'submitted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', retailerId);

  if (error) {
    console.error('[submitForReview] error:', error.message);
    return { error: 'Failed to submit. Please try again.' };
  }

  return null;
}
