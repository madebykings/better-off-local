'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  DAY_KEYS,
  type DayKey,
  type OpeningHoursData,
} from '@/lib/utils/opening_hours';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OpeningHoursActionResult = {
  error?: string;
  fieldErrors?: Partial<Record<DayKey, string>>;
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
// Validation
// ---------------------------------------------------------------------------

function validateHours(hours: OpeningHoursData): OpeningHoursActionResult | null {
  // At least one open day is required during onboarding.
  // Dashboard editing can relax this constraint later.
  const hasOpenDay = DAY_KEYS.some((day) => hours[day].open);
  if (!hasOpenDay) {
    return { error: 'Please mark at least one day as open before continuing.' };
  }

  const fieldErrors: Partial<Record<DayKey, string>> = {};

  for (const day of DAY_KEYS) {
    const { open, all_day, start, end } = hours[day];
    if (!open || all_day) continue;

    if (!start || !end) {
      fieldErrors[day] = 'Please set opening and closing times.';
      continue;
    }
    // "HH:MM" string comparison is correct for zero-padded 24-hour times.
    if (end <= start) {
      fieldErrors[day] = 'Closing time must be after opening time.';
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Save opening hours
// ---------------------------------------------------------------------------

/**
 * Persists opening hours to the primary retailer location's
 * opening_hours_json column.
 *
 * The JSON shape stored here is read directly by the Flutter consumer app.
 * Do not change key names or types without a coordinated app release.
 *
 * Advances onboarding_step to 'links' only if currently on 'opening-hours'.
 * If the step advance fails, returns an error to block navigation — the
 * hours data is already saved at that point.
 *
 * Returns null on success, { error } or { fieldErrors } on failure.
 */
/**
 * Dashboard variant — saves opening hours for a specific location without
 * touching onboarding_step. Used from the venue edit page post-onboarding.
 */
export async function saveOpeningHoursForLocation(
  locationId: string,
  hours: OpeningHoursData,
): Promise<OpeningHoursActionResult | null> {
  const validationResult = validateHours(hours);
  if (validationResult) return validationResult;

  const userId = await getAuthUserId();
  const retailerId = await getRetailerId(userId);
  if (!retailerId) return { error: 'No retailer record found.' };

  const service = createServiceClient();

  // Verify ownership before writing.
  const { data: location } = await service
    .from('retailer_locations')
    .select('id')
    .eq('id', locationId)
    .eq('retailer_id', retailerId)
    .maybeSingle();

  if (!location) return { error: 'Location not found.' };

  const { error: updateError } = await service
    .from('retailer_locations')
    .update({ opening_hours_json: hours })
    .eq('id', locationId);

  if (updateError) {
    console.error('[saveOpeningHoursForLocation] error:', updateError.message);
    return { error: 'Failed to save opening hours. Please try again.' };
  }

  return null;
}

export async function saveOpeningHours(
  hours: OpeningHoursData,
): Promise<OpeningHoursActionResult | null> {
  const validationResult = validateHours(hours);
  if (validationResult) return validationResult;

  const userId = await getAuthUserId();
  const retailerId = await getRetailerId(userId);

  if (!retailerId) {
    return { error: 'No retailer record found. Please complete the previous steps.' };
  }

  const service = createServiceClient();

  // Read current step before mutating.
  const { data: retailer } = await service
    .from('retailers')
    .select('onboarding_step')
    .eq('id', retailerId)
    .single();

  // Locate the primary location — must exist (created during location step).
  const { data: location } = await service
    .from('retailer_locations')
    .select('id')
    .eq('retailer_id', retailerId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!location) {
    return { error: 'No location found. Please complete the location step first.' };
  }

  const { error: updateError } = await service
    .from('retailer_locations')
    .update({ opening_hours_json: hours })
    .eq('id', location.id);

  if (updateError) {
    console.error('[saveOpeningHours] update error:', updateError.message);
    return { error: 'Failed to save opening hours. Please try again.' };
  }

  // Advance step — only if currently on 'opening-hours'.
  // Return an error on failure to block navigation; hours are already saved.
  if (retailer?.onboarding_step === 'opening-hours') {
    const { error: stepError } = await service
      .from('retailers')
      .update({ onboarding_step: 'links', updated_at: new Date().toISOString() })
      .eq('id', retailerId);

    if (stepError) {
      console.error('[saveOpeningHours] step advance error:', stepError.message);
      return {
        error: 'Your hours were saved, but we could not advance to the next step. Please try again.',
      };
    }
  }

  return null;
}
