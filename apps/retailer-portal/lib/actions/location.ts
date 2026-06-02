'use server';

import { revalidatePath } from 'next/cache';
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

// Extended fields for named multi-venue management.
export interface VenueFields extends LocationFields {
  name: string;
  regionId: string;       // uuid of selected region, or '' if none
  phone: string;          // → retailer_locations.phone (venue-level public phone)
  websiteUrl: string;     // → retailer_locations.website_url
  shortDescription: string; // → retailer_locations.short_description
  description: string;    // → retailer_locations.description (long form)
}

export interface VenueActionResult {
  error?: string;
  fieldErrors?: Partial<Record<keyof VenueFields, string>>;
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

// ---------------------------------------------------------------------------
// Dashboard update (no step advancement)
// ---------------------------------------------------------------------------

/**
 * Updates the primary location for the authenticated retailer.
 * Identical to saveRetailerLocation but never advances onboarding_step.
 * Safe to call from the post-onboarding dashboard.
 */
export async function updateRetailerLocation(
  fields: LocationFields,
): Promise<LocationActionResult | null> {
  const fieldErrors = validateLocation(fields);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/sign-in');

  const service = createServiceClient();
  const { data: link } = await service
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!link) return { error: 'No retailer account found.' };

  const postcode = normalisePostcode(fields.postcode);
  const payload = {
    address_line_1: fields.addressLine1.trim(),
    address_line_2: fields.addressLine2.trim() || null,
    town: fields.town.trim(),
    county: fields.county.trim() || null,
    postcode,
    country: 'United Kingdom',
  };

  const { data: existing } = await service
    .from('retailer_locations')
    .select('id')
    .eq('retailer_id', link.retailer_id)
    .eq('is_primary', true)
    .maybeSingle();

  if (existing) {
    const { error } = await service
      .from('retailer_locations')
      .update(payload)
      .eq('id', existing.id);
    if (error) {
      console.error('[updateRetailerLocation] update error:', error.message);
      return { error: 'Failed to save location. Please try again.' };
    }
  } else {
    const { error } = await service
      .from('retailer_locations')
      .insert({ ...payload, retailer_id: link.retailer_id, is_primary: true, is_active: true });
    if (error) {
      console.error('[updateRetailerLocation] insert error:', error.message);
      return { error: 'Failed to save location. Please try again.' };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Multi-venue CRUD
// ---------------------------------------------------------------------------

function validateVenue(fields: VenueFields): Partial<Record<keyof VenueFields, string>> {
  const errors: Partial<Record<keyof VenueFields, string>> = {};
  if (!fields.name.trim()) {
    errors.name = 'Venue name is required (e.g. "High Street Branch").';
  }
  if (!fields.regionId) {
    errors.regionId = 'Please select the region this venue is in.';
  }
  const locationErrors = validateLocation(fields);
  return { ...errors, ...locationErrors };
}

async function getRetailerCtxForVenue(): Promise<{ retailerId: string } | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect('/sign-in');
  const service = createServiceClient();
  const { data } = await service
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (!data) return null;
  return { retailerId: data.retailer_id };
}

/**
 * Creates a new venue for the authenticated retailer.
 * Server-side entitlement check: active venue count must be below allowance.
 * Returns { locationId } on success.
 */
export async function createVenue(
  fields: VenueFields,
): Promise<{ locationId: string } | VenueActionResult> {
  const fieldErrors = validateVenue(fields);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const ctx = await getRetailerCtxForVenue();
  if (!ctx) return { error: 'No retailer account found.' };

  const service = createServiceClient();

  const { count: activeCount } = await service
    .from('retailer_locations')
    .select('id', { count: 'exact', head: true })
    .eq('retailer_id', ctx.retailerId)
    .eq('is_active', true);

  // First venue becomes primary automatically.
  const isPrimary = (activeCount ?? 0) === 0;

  // Determine billing_status from region member count.
  let billingStatus = 'free_growth_region';

  if (fields.regionId && !isPrimary) {
    const { data: region } = await service
      .from('regions')
      .select('member_threshold')
      .eq('id', fields.regionId)
      .maybeSingle();

    const { data: memberCount } = await service
      .rpc('region_active_member_count', { p_region_id: fields.regionId });

    const threshold = region?.member_threshold ?? 100;
    const count = (memberCount as number | null) ?? 0;

    if (count >= threshold) {
      return {
        error: 'This region has reached its member threshold. An additional venue subscription (£9.99/year) is required to add a venue here.',
      };
    }
  }

  const postcode = normalisePostcode(fields.postcode);
  const { data: location, error } = await service
    .from('retailer_locations')
    .insert({
      retailer_id: ctx.retailerId,
      region_id: fields.regionId || null,
      billing_status: billingStatus,
      name: fields.name.trim(),
      address_line_1: fields.addressLine1.trim(),
      address_line_2: fields.addressLine2.trim() || null,
      town: fields.town.trim(),
      county: fields.county.trim() || null,
      postcode,
      country: 'United Kingdom',
      is_primary: isPrimary,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !location) {
    console.error('[createVenue] insert error:', error?.message);
    return { error: 'Failed to create venue. Please try again.' };
  }

  revalidatePath('/locations');
  return { locationId: location.id };
}

/**
 * Updates an existing venue. Verifies retailer ownership.
 */
export async function updateVenue(
  locationId: string,
  fields: VenueFields,
): Promise<VenueActionResult | null> {
  const fieldErrors = validateVenue(fields);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const ctx = await getRetailerCtxForVenue();
  if (!ctx) return { error: 'No retailer account found.' };

  const service = createServiceClient();

  const { data: existing } = await service
    .from('retailer_locations')
    .select('id')
    .eq('id', locationId)
    .eq('retailer_id', ctx.retailerId)
    .eq('is_active', true)
    .maybeSingle();

  if (!existing) return { error: 'Venue not found.' };

  const postcode = normalisePostcode(fields.postcode);
  const { error } = await service
    .from('retailer_locations')
    .update({
      region_id:         fields.regionId || null,
      name:              fields.name.trim(),
      address_line_1:    fields.addressLine1.trim(),
      address_line_2:    fields.addressLine2.trim() || null,
      town:              fields.town.trim(),
      county:            fields.county.trim() || null,
      postcode,
      country:           'United Kingdom',
      phone:             fields.phone.trim() || null,
      website_url:       fields.websiteUrl.trim() || null,
      short_description: fields.shortDescription.trim() || null,
      description:       fields.description.trim() || null,
    })
    .eq('id', locationId);

  if (error) {
    console.error('[updateVenue] error:', error.message);
    return { error: 'Failed to save venue. Please try again.' };
  }

  revalidatePath('/locations');
  revalidatePath(`/locations/${locationId}`);
  return null;
}

/**
 * Soft-deletes a venue (is_active = false). Verifies ownership.
 * Cannot deactivate the only remaining venue.
 * If the deactivated venue was primary, auto-promotes the oldest remaining
 * active venue as the new primary.
 */
export async function deactivateVenue(formData: FormData): Promise<void> {
  const locationId = formData.get('location_id') as string;
  const ctx = await getRetailerCtxForVenue();
  if (!ctx) return;

  const service = createServiceClient();

  const { data: loc } = await service
    .from('retailer_locations')
    .select('is_primary')
    .eq('id', locationId)
    .eq('retailer_id', ctx.retailerId)
    .eq('is_active', true)
    .maybeSingle();

  if (!loc) return;

  // Prevent deactivating the only remaining active venue.
  const { count } = await service
    .from('retailer_locations')
    .select('id', { count: 'exact', head: true })
    .eq('retailer_id', ctx.retailerId)
    .eq('is_active', true);

  if ((count ?? 0) <= 1) return;

  await service
    .from('retailer_locations')
    .update({ is_active: false, is_primary: false })
    .eq('id', locationId);

  // Auto-promote oldest active venue if we just deactivated the primary.
  if (loc.is_primary) {
    const { data: next } = await service
      .from('retailer_locations')
      .select('id')
      .eq('retailer_id', ctx.retailerId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next) {
      await service
        .from('retailer_locations')
        .update({ is_primary: true })
        .eq('id', next.id);
    }
  }

  revalidatePath('/locations');
  redirect('/locations');
}
