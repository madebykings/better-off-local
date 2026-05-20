'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocationFields {
  addressLine1: string;
  addressLine2: string;
  town: string;
  county: string;
  postcode: string;
}

export interface LocationActionResult {
  error?: string;
  fieldErrors?: Partial<Record<keyof LocationFields, string>>;
}

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

/**
 * Normalises a raw postcode string to the canonical UK format with a single
 * space before the inward code (e.g. "fk101aa" → "FK10 1AA").
 */
function normalisePostcode(raw: string): string {
  const stripped = raw.toUpperCase().replace(/\s+/g, '');
  if (stripped.length < 4) return stripped;
  return `${stripped.slice(0, -3)} ${stripped.slice(-3)}`;
}

/** Validates a normalised UK postcode (with space). */
const UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]? [0-9][A-Z]{2}$/;

function validateLocation(
  fields: LocationFields,
): Partial<Record<keyof LocationFields, string>> {
  const errors: Partial<Record<keyof LocationFields, string>> = {};

  if (!fields.addressLine1.trim()) {
    errors.addressLine1 = 'Address line 1 is required.';
  }
  if (!fields.town.trim()) {
    errors.town = 'Town or city is required.';
  }

  const normalisedPostcode = normalisePostcode(fields.postcode);
  if (!fields.postcode.trim()) {
    errors.postcode = 'Postcode is required.';
  } else if (!UK_POSTCODE_RE.test(normalisedPostcode)) {
    errors.postcode = 'Please enter a valid UK postcode (e.g. FK10 1AA).';
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Save retailer location
// ---------------------------------------------------------------------------

/**
 * Creates or updates the primary location for the authenticated retailer.
 *
 * On first call: inserts a new row with is_primary = true, is_active = true.
 * On subsequent calls: updates the existing primary row in place — no
 * delete-then-reinsert, so there is no partial-failure window.
 *
 * Country is always stored as 'United Kingdom'; the UI shows a display-only
 * label rather than a free-text input.
 *
 * Lat/lng are not set during onboarding. They remain null until a future
 * postcode geocoding hook populates them.
 * TODO: After saving, trigger a background job to geocode the postcode via
 * an OS Places / Google Geocoding API and backfill latitude + longitude on
 * the retailer_locations row.
 *
 * Advances onboarding_step to 'opening-hours' only if currently on
 * 'location'. If the step advance fails, an error is returned so the client
 * can surface it and block navigation — the location data is already saved.
 */
export async function saveRetailerLocation(
  fields: LocationFields,
): Promise<LocationActionResult | null> {
  const fieldErrors = validateLocation(fields);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

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

  const postcode = normalisePostcode(fields.postcode);

  const locationPayload = {
    address_line_1: fields.addressLine1.trim(),
    address_line_2: fields.addressLine2.trim() || null,
    town: fields.town.trim(),
    county: fields.county.trim() || null,
    postcode,
    country: 'United Kingdom',
    // latitude and longitude are intentionally omitted here.
    // See TODO above re: postcode geocoding hook.
  };

  // Check for an existing primary location row.
  const { data: existing } = await service
    .from('retailer_locations')
    .select('id')
    .eq('retailer_id', retailerId)
    .eq('is_primary', true)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await service
      .from('retailer_locations')
      .update(locationPayload)
      .eq('id', existing.id);

    if (updateError) {
      console.error('[saveRetailerLocation] update error:', updateError.message);
      return { error: 'Failed to save location. Please try again.' };
    }
  } else {
    const { error: insertError } = await service
      .from('retailer_locations')
      .insert({
        ...locationPayload,
        retailer_id: retailerId,
        is_primary: true,
        is_active: true,
      });

    if (insertError) {
      console.error('[saveRetailerLocation] insert error:', insertError.message);
      return { error: 'Failed to save location. Please try again.' };
    }
  }

  // Advance step — only if currently on 'location'.
  // If this fails, return an error so the client surfaces it and blocks
  // navigation. The location data is already persisted at this point.
  if (retailer?.onboarding_step === 'location') {
    const { error: stepError } = await service
      .from('retailers')
      .update({ onboarding_step: 'opening-hours', updated_at: new Date().toISOString() })
      .eq('id', retailerId);

    if (stepError) {
      console.error('[saveRetailerLocation] step advance error:', stepError.message);
      return {
        error: 'Your location was saved, but we could not advance to the next step. Please try again.',
      };
    }
  }

  return null;
}
