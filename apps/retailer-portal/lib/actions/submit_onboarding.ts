'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { parseOpeningHours, DAY_KEYS } from '@/lib/actions/opening_hours';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubmitOnboardingResult = {
  errors?: string[];  // blocking validation errors — shown as list
  error?: string;     // unexpected top-level error
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect('/sign-in');
  return user.id;
}

async function getRetailerId(userId: string): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', userId)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

/**
 * Validates all required onboarding sections server-side and, if complete,
 * advances onboarding_step to 'submitted'.
 *
 * Idempotent: if onboarding_step is already 'submitted', returns null
 * immediately without any DB writes.
 *
 * approval_status is reset to 'pending' only when it was previously
 * 'rejected'. It is left unchanged when 'pending' (default), 'approved',
 * or 'suspended' — so an already-approved retailer is never regressed.
 */
export async function submitOnboarding(): Promise<SubmitOnboardingResult | null> {
  const userId = await getAuthUserId();
  const retailerId = await getRetailerId(userId);

  if (!retailerId) {
    return { error: 'No retailer record found. Please complete the previous steps.' };
  }

  const service = createServiceClient();

  // Fetch all sections needed for validation in parallel.
  const [
    { data: retailer },
    { count: categoryCount },
    { data: location },
    { data: links },
    { data: offer },
  ] = await Promise.all([
    service
      .from('retailers')
      .select('name, cover_image_url, phone, email, approval_status, onboarding_step')
      .eq('id', retailerId)
      .single(),
    service
      .from('retailer_categories')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId),
    service
      .from('retailer_locations')
      .select('address_line_1, postcode, opening_hours_json')
      .eq('retailer_id', retailerId)
      .eq('is_primary', true)
      .maybeSingle(),
    service
      .from('retailer_links')
      .select('type')
      .eq('retailer_id', retailerId),
    service
      .from('offers')
      .select('title, value_text')
      .eq('retailer_id', retailerId)
      .eq('onboarding_source', 'first-offer')
      .maybeSingle(),
  ]);

  if (!retailer) {
    return { error: 'Could not load retailer data. Please try again.' };
  }

  // Idempotent — already submitted and not awaiting changes.
  // If approval_status is 'changes_requested', allow resubmission.
  if (
    retailer.onboarding_step === 'submitted' &&
    retailer.approval_status !== 'changes_requested'
  ) {
    return null;
  }

  // ── Validate required sections ───────────────────────────────────────────
  const errors: string[] = [];

  if (!retailer.name?.trim()) {
    errors.push('Business name is required — complete Business details.');
  }

  if (!retailer.cover_image_url?.trim()) {
    errors.push('A cover image is required — complete Branding.');
  }

  if (!categoryCount || categoryCount === 0) {
    errors.push('At least one category is required — complete Categories.');
  }

  if (!location?.address_line_1?.trim() || !location?.postcode?.trim()) {
    errors.push('A business address is required — complete Location.');
  }

  const parsedHours = location?.opening_hours_json
    ? parseOpeningHours(location.opening_hours_json)
    : null;
  const hasOpenDay = parsedHours ? DAY_KEYS.some((k) => parsedHours[k].open) : false;

  if (!hasOpenDay) {
    errors.push('At least one opening day is required — complete Opening hours.');
  }

  const hasContact =
    Boolean(retailer.phone?.trim()) ||
    Boolean(retailer.email?.trim()) ||
    (links?.length ?? 0) > 0;

  if (!hasContact) {
    errors.push('At least one contact method is required — complete Links & contact.');
  }

  if (!offer?.title?.trim() || !offer?.value_text?.trim()) {
    errors.push('A first offer is required — complete First offer.');
  }

  if (errors.length > 0) {
    return { errors };
  }

  // ── Persist ──────────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const isResubmission = retailer.approval_status === 'changes_requested';

  const updatePayload: Record<string, unknown> = {
    onboarding_step: 'submitted',
    submitted_at:    now,
    updated_at:      now,
  };

  // Reset approval_status to pending after rejection or changes-requested.
  // Leave unchanged when pending/approved/suspended.
  if (retailer.approval_status === 'rejected' || isResubmission) {
    updatePayload.approval_status = 'pending';
  }

  const { error: updateError } = await service
    .from('retailers')
    .update(updatePayload)
    .eq('id', retailerId);

  if (updateError) {
    console.error('[submitOnboarding] update error:', updateError.message);
    return { error: 'Submission failed. Please try again.' };
  }

  // Log resubmission to the admin audit trail.
  if (isResubmission) {
    await service.from('admin_actions').insert({
      admin_profile_id: userId,
      action_type:      'retailer_resubmitted',
      target_table:     'retailers',
      target_id:        retailerId,
      reason:           null,
      metadata_json:    null,
    });
  }

  return null;
}
