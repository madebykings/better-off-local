'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { DAY_KEYS, type OpeningHoursData } from '@/lib/utils/opening_hours';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function toggleCategoryActive(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const id = formData.get('id') as string;
  const currentActive = formData.get('is_active') === 'true';

  const supabase = createServiceClient();
  await supabase
    .from('categories')
    .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
    .eq('id', id);

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: currentActive ? 'category_deactivated' : 'category_activated',
    target_table: 'categories',
    target_id: id,
    reason: null,
    metadata_json: null,
  });

  revalidatePath('/categories');
}

export async function createCategory(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const icon = (formData.get('icon') as string | null)?.trim() || null;

  if (name.length < 2) return;

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('categories')
    .insert({ name, slug, icon, is_active: true, sort_order: 0 });

  if (error) {
    console.error('[createCategory] error:', error.message);
    return;
  }

  revalidatePath('/categories');
}

export async function updateCategoryIcon(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get('id') as string;
  const icon = (formData.get('icon') as string | null)?.trim() || null;

  const supabase = createServiceClient();
  await supabase
    .from('categories')
    .update({ icon, updated_at: new Date().toISOString() })
    .eq('id', id);

  revalidatePath('/categories');
}

// ---------------------------------------------------------------------------
// Retailers
// ---------------------------------------------------------------------------

export async function createRetailer(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const businessType = (formData.get('business_type') as string | null)?.trim() || null;

  if (name.length < 2) return;

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') +
    '-' +
    crypto.randomUUID().slice(0, 6);

  const supabase = createServiceClient();
  const { data: retailer, error } = await supabase
    .from('retailers')
    .insert({
      name,
      slug,
      business_type: businessType,
      approval_status: 'approved',
      visibility_status: 'draft',
      onboarding_step: 'submitted',
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !retailer) {
    console.error('[createRetailer] error:', error?.message);
    return;
  }

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: 'retailer_created',
    target_table: 'retailers',
    target_id: retailer.id,
    reason: 'Manually created by admin',
    metadata_json: { name, slug },
  });

  revalidatePath('/retailers');
}

export async function deactivateRetailer(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const id = formData.get('id') as string;
  const currentActive = formData.get('is_active') === 'true';

  const supabase = createServiceClient();
  await supabase
    .from('retailers')
    .update({
      is_active: !currentActive,
      visibility_status: currentActive ? 'hidden' : 'draft',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: currentActive ? 'retailer_deactivated' : 'retailer_reactivated',
    target_table: 'retailers',
    target_id: id,
    reason: null,
    metadata_json: null,
  });

  revalidatePath('/retailers');
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function cancelMembership(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const membershipId = formData.get('membership_id') as string;

  const supabase = createServiceClient();
  await supabase
    .from('consumer_memberships')
    .update({
      status: 'cancelled',
      cancel_at_period_end: false,
      ended_at: new Date().toISOString(),
    })
    .eq('id', membershipId);

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: 'membership_cancelled',
    target_table: 'consumer_memberships',
    target_id: membershipId,
    reason: 'Cancelled by admin',
    metadata_json: null,
  });

  revalidatePath(`/members/${membershipId}`);
  revalidatePath('/members');
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

export async function updateRegion(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const regionId = formData.get('region_id') as string;
  const threshold = parseInt(formData.get('member_threshold') as string, 10);
  const isActive = formData.get('is_active') === 'true';

  if (isNaN(threshold) || threshold < 1) return;

  const supabase = createServiceClient();
  await supabase
    .from('regions')
    .update({ member_threshold: threshold, is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', regionId);

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: 'region_updated',
    target_table: 'regions',
    target_id: regionId,
    reason: null,
    metadata_json: { member_threshold: threshold, is_active: isActive },
  });

  revalidatePath('/regions');
}

// ---------------------------------------------------------------------------
// Venue region + billing status (admin override)
// ---------------------------------------------------------------------------

export async function setVenueRegion(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const locationId = formData.get('location_id') as string;
  const regionId = (formData.get('region_id') as string | null) || null;

  const supabase = createServiceClient();
  await supabase
    .from('retailer_locations')
    .update({ region_id: regionId })
    .eq('id', locationId);

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: 'venue_region_set',
    target_table: 'retailer_locations',
    target_id: locationId,
    reason: null,
    metadata_json: { region_id: regionId },
  });

  revalidatePath('/retailers');
  revalidatePath('/venues');
  revalidatePath(`/venues/${locationId}`);
}

export async function setVenueBillingStatus(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const locationId  = formData.get('location_id') as string;
  const retailerId  = formData.get('retailer_id') as string;
  const newStatus   = formData.get('billing_status') as string;

  const allowed = ['free_growth_region', 'paid_required', 'paid', 'admin_waived'];
  if (!allowed.includes(newStatus)) return;

  const supabase = createServiceClient();

  await supabase
    .from('retailer_locations')
    .update({ billing_status: newStatus, grace_period_ends_at: null })
    .eq('id', locationId);

  // If primary venue is waived and retailer is approved, ensure they are live.
  if (newStatus === 'admin_waived') {
    const { data: loc } = await supabase
      .from('retailer_locations')
      .select('is_primary')
      .eq('id', locationId)
      .maybeSingle();

    if (loc?.is_primary) {
      await supabase
        .from('retailers')
        .update({ visibility_status: 'live' })
        .eq('id', retailerId)
        .eq('approval_status', 'approved');
    }
  }

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: 'venue_billing_status_set',
    target_table: 'retailer_locations',
    target_id: locationId,
    reason: null,
    metadata_json: { billing_status: newStatus, retailer_id: retailerId },
  });

  revalidatePath(`/retailers/${retailerId}`);
}

// ---------------------------------------------------------------------------
// Venue allowance (admin override)
// ---------------------------------------------------------------------------

/**
 * Sets or clears the admin venue allowance override for a retailer.
 * override = '' clears the override (reverts to computed value).
 */
export async function setVenueAllowanceOverride(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const retailerId = formData.get('retailer_id') as string;
  const raw        = (formData.get('override') as string | null)?.trim() ?? '';

  const override = raw === '' ? null : parseInt(raw, 10);
  if (override !== null && (isNaN(override) || override < 1)) return;

  const supabase = createServiceClient();

  await supabase
    .from('retailer_subscriptions')
    .update({ venue_allowance_override: override })
    .eq('retailer_id', retailerId);

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: 'venue_allowance_override_set',
    target_table: 'retailers',
    target_id: retailerId,
    reason: override === null ? 'Override cleared' : `Allowance set to ${override}`,
    metadata_json: { venue_allowance_override: override },
  });

  revalidatePath(`/retailers/${retailerId}`);
}

/**
 * Soft-deletes a retailer venue. Auto-promotes oldest remaining active venue
 * as primary if the deactivated venue was primary.
 * Cannot deactivate the only remaining active venue.
 */
export async function deactivateRetailerVenue(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const locationId = formData.get('location_id') as string;
  const retailerId = formData.get('retailer_id') as string;

  const supabase = createServiceClient();

  const { data: loc } = await supabase
    .from('retailer_locations')
    .select('is_primary')
    .eq('id', locationId)
    .eq('retailer_id', retailerId)
    .eq('is_active', true)
    .maybeSingle();

  if (!loc) return;

  const { count } = await supabase
    .from('retailer_locations')
    .select('id', { count: 'exact', head: true })
    .eq('retailer_id', retailerId)
    .eq('is_active', true);

  if ((count ?? 0) <= 1) return;

  await supabase
    .from('retailer_locations')
    .update({ is_active: false, is_primary: false })
    .eq('id', locationId);

  if (loc.is_primary) {
    const { data: next } = await supabase
      .from('retailer_locations')
      .select('id')
      .eq('retailer_id', retailerId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next) {
      await supabase.from('retailer_locations').update({ is_primary: true }).eq('id', next.id);
    }
  }

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: 'venue_deactivated',
    target_table: 'retailer_locations',
    target_id: locationId,
    reason: 'Deactivated by admin',
    metadata_json: { retailer_id: retailerId },
  });

  revalidatePath(`/retailers/${retailerId}`);
  revalidatePath('/venues');
}

// ---------------------------------------------------------------------------
// Venue moderation
// ---------------------------------------------------------------------------

/**
 * Approves a venue listing, making it visible in consumer discovery.
 * Clears any previous review notes.
 */
export async function approveVenue(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const locationId = formData.get('location_id') as string;
  const retailerId = formData.get('retailer_id') as string;

  const supabase = createServiceClient();

  const { data: venue } = await supabase
    .from('retailer_locations')
    .select('id, review_status')
    .eq('id', locationId)
    .eq('retailer_id', retailerId)
    .maybeSingle();

  if (!venue || venue.review_status === 'approved') return;

  await supabase
    .from('retailer_locations')
    .update({
      review_status: 'approved',
      review_notes:  null,
      approved_at:   new Date().toISOString(),
      approved_by:   userId,
    })
    .eq('id', locationId);

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type:      'venue_approved',
    target_table:     'retailer_locations',
    target_id:        locationId,
    reason:           'Approved by admin',
    metadata_json:    { retailer_id: retailerId },
  });

  revalidatePath(`/retailers/${retailerId}`);
  revalidatePath('/venues');
  revalidatePath(`/venues/${locationId}`);
  revalidatePath('/featured');
}

/**
 * Rejects a venue listing. A rejection note is required so the retailer
 * knows what to fix before resubmitting.
 */
export async function rejectVenue(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const locationId = formData.get('location_id') as string;
  const retailerId = formData.get('retailer_id') as string;
  const note       = (formData.get('review_notes') as string | null)?.trim() ?? '';

  if (!note) return;

  const supabase = createServiceClient();

  const { data: venue } = await supabase
    .from('retailer_locations')
    .select('id, review_status')
    .eq('id', locationId)
    .eq('retailer_id', retailerId)
    .maybeSingle();

  if (!venue || venue.review_status === 'rejected') return;

  await supabase
    .from('retailer_locations')
    .update({
      review_status: 'rejected',
      review_notes:  note,
      rejected_at:   new Date().toISOString(),
      rejected_by:   userId,
    })
    .eq('id', locationId);

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type:      'venue_rejected',
    target_table:     'retailer_locations',
    target_id:        locationId,
    reason:           note,
    metadata_json:    { retailer_id: retailerId },
  });

  revalidatePath(`/retailers/${retailerId}`);
  revalidatePath('/venues');
  revalidatePath(`/venues/${locationId}`);
  revalidatePath('/featured');
}

// ---------------------------------------------------------------------------
// Featured venues (venue-level featured badge for BusinessCard)
// ---------------------------------------------------------------------------

/**
 * Toggles the is_featured flag on a retailer_location row.
 * This drives the ⭐ Featured badge on BusinessCards in the mobile app.
 * Featured status is venue-level: a retailer can have one featured venue
 * without featuring every venue they own.
 */
export async function toggleVenueFeatured(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const locationId = formData.get('location_id') as string;
  const retailerId = formData.get('retailer_id') as string;
  const currentFeatured = formData.get('is_featured') === 'true';

  const supabase = createServiceClient();

  // When featuring (not unfeaturing), enforce that the venue is active and approved.
  if (!currentFeatured) {
    const { data: venue } = await supabase
      .from('retailer_locations')
      .select('is_active, review_status')
      .eq('id', locationId)
      .maybeSingle();

    if (!venue || !venue.is_active || venue.review_status !== 'approved') return;
  }

  await supabase
    .from('retailer_locations')
    .update({ is_featured: !currentFeatured })
    .eq('id', locationId);

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: currentFeatured ? 'venue_unfeatured' : 'venue_featured',
    target_table: 'retailer_locations',
    target_id: locationId,
    reason: null,
    metadata_json: { retailer_id: retailerId },
  });

  revalidatePath(`/retailers/${retailerId}`);
  revalidatePath('/venues');
  revalidatePath(`/venues/${locationId}`);
  revalidatePath('/featured');
}

// ---------------------------------------------------------------------------
// Featured offers
// ---------------------------------------------------------------------------

export async function toggleOfferFeatured(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const id = formData.get('id') as string;
  const currentFeatured = formData.get('is_featured') === 'true';

  const supabase = createServiceClient();
  await supabase
    .from('offers')
    .update({ is_featured: !currentFeatured, updated_at: new Date().toISOString() })
    .eq('id', id);

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: currentFeatured ? 'offer_unfeatured' : 'offer_featured',
    target_table: 'offers',
    target_id: id,
    reason: null,
    metadata_json: null,
  });

  revalidatePath('/featured');
}

// ---------------------------------------------------------------------------
// Retailer editing
// ---------------------------------------------------------------------------

export async function updateRetailerDetails(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const retailerId = formData.get('retailer_id') as string;

  const supabase = createServiceClient();
  await supabase
    .from('retailers')
    .update({
      name:             (formData.get('name')          as string | null)?.trim() || undefined,
      tagline:          (formData.get('tagline')        as string | null)?.trim() || null,
      short_description:(formData.get('short_description') as string | null)?.trim() || null,
      contact_name:     (formData.get('contact_name')  as string | null)?.trim() || null,
      phone:            (formData.get('phone')          as string | null)?.trim() || null,
      email:            (formData.get('email')          as string | null)?.trim() || null,
      business_type:    (formData.get('business_type') as string | null)?.trim() || null,
      partner_type:     (formData.get('partner_type') as string | null)?.trim() || 'business',
      updated_at:       new Date().toISOString(),
    })
    .eq('id', retailerId);

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: 'retailer_details_updated',
    target_table: 'retailers',
    target_id: retailerId,
    reason: 'Edited by admin',
    metadata_json: null,
  });

  revalidatePath(`/retailers/${retailerId}`);
}

// ---------------------------------------------------------------------------
// Venue editing
// ---------------------------------------------------------------------------

const UK_POSTCODE_RE = /^[A-Z]{1,2}[0-9][0-9A-Z]? [0-9][A-Z]{2}$/;

function normalizePostcode(raw: string): string {
  const stripped = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (stripped.length < 5) return raw.trim().toUpperCase();
  return `${stripped.slice(0, stripped.length - 3)} ${stripped.slice(stripped.length - 3)}`;
}

export async function updateVenueDetails(formData: FormData): Promise<void> {
  const { userId } = await requireAdmin();
  const locationId = formData.get('location_id') as string;
  const retailerId = formData.get('retailer_id') as string;

  const rawPostcode = (formData.get('postcode') as string | null)?.trim() ?? '';
  const postcode    = rawPostcode ? normalizePostcode(rawPostcode) : null;
  if (postcode && !UK_POSTCODE_RE.test(postcode)) {
    throw new Error(`Invalid UK postcode: ${postcode}`);
  }

  const rawLat   = (formData.get('latitude')  as string | null)?.trim();
  const rawLng   = (formData.get('longitude') as string | null)?.trim();
  const parsedLat = rawLat ? parseFloat(rawLat) : null;
  const parsedLng = rawLng ? parseFloat(rawLng) : null;
  const latitude  = parsedLat !== null && !isNaN(parsedLat) && parsedLat >= -90  && parsedLat <= 90  ? parsedLat : null;
  const longitude = parsedLng !== null && !isNaN(parsedLng) && parsedLng >= -180 && parsedLng <= 180 ? parsedLng : null;

  const isActive = formData.get('is_active') === 'on';

  const supabase = createServiceClient();
  await supabase
    .from('retailer_locations')
    .update({
      name:              (formData.get('name')              as string | null)?.trim() || null,
      address_line_1:    (formData.get('address_line_1')    as string | null)?.trim() || null,
      address_line_2:    (formData.get('address_line_2')    as string | null)?.trim() || null,
      town:              (formData.get('town')              as string | null)?.trim() || null,
      county:            (formData.get('county')            as string | null)?.trim() || null,
      postcode,
      latitude,
      longitude,
      is_active:         isActive,
      phone:             (formData.get('phone')             as string | null)?.trim() || null,
      website_url:       (formData.get('website_url')       as string | null)?.trim() || null,
      short_description: (formData.get('short_description') as string | null)?.trim() || null,
      description:       (formData.get('description')       as string | null)?.trim() || null,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', locationId);

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type:      'venue_details_updated',
    target_table:     'retailer_locations',
    target_id:        locationId,
    reason:           'Edited by admin',
    metadata_json:    { retailer_id: retailerId },
  });

  revalidatePath(`/retailers/${retailerId}`);
  revalidatePath('/venues');
  revalidatePath(`/venues/${locationId}`);
}

export async function updateAdminVenueOpeningHours(
  locationId: string,
  hours: OpeningHoursData,
): Promise<{ error?: string } | null> {
  const { userId } = await requireAdmin();

  for (const day of DAY_KEYS) {
    const { open, all_day, start, end } = hours[day];
    if (!open || all_day) continue;
    if (!start || !end) return { error: `${day}: please set opening and closing times.` };
    if (end <= start)   return { error: `${day}: closing time must be after opening time.` };
  }

  const supabase = createServiceClient();
  const { error: updateError } = await supabase
    .from('retailer_locations')
    .update({ opening_hours_json: hours, updated_at: new Date().toISOString() })
    .eq('id', locationId);

  if (updateError) {
    console.error('[updateAdminVenueOpeningHours]', updateError.message);
    return { error: 'Failed to save opening hours.' };
  }

  const { data: loc } = await supabase
    .from('retailer_locations')
    .select('retailer_id')
    .eq('id', locationId)
    .single();

  if (loc?.retailer_id) {
    await supabase.from('admin_actions').insert({
      admin_profile_id: userId,
      action_type:      'venue_opening_hours_updated',
      target_table:     'retailer_locations',
      target_id:        locationId,
      reason:           'Edited by admin',
      metadata_json:    { retailer_id: loc.retailer_id },
    });
    revalidatePath(`/retailers/${loc.retailer_id}`);
    revalidatePath('/venues');
    revalidatePath(`/venues/${locationId}`);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Region management
// ---------------------------------------------------------------------------

export async function createRegion(formData: FormData): Promise<void> {
  await requireAdmin();
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const description = (formData.get('description') as string | null)?.trim() || null;
  const threshold = parseInt((formData.get('member_threshold') as string | null) ?? '500', 10);

  if (name.length < 2) return;

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const supabase = createServiceClient();
  await supabase.from('regions').insert({
    name,
    slug,
    description,
    country: 'GB',
    postcode_prefixes: [],
    member_threshold: isNaN(threshold) ? 500 : threshold,
    is_active: true,
  });

  revalidatePath('/regions');
}

export async function updateRegionDetails(formData: FormData): Promise<void> {
  await requireAdmin();
  const regionId = formData.get('region_id') as string;
  const supabase = createServiceClient();

  await supabase
    .from('regions')
    .update({
      name:             (formData.get('name') as string | null)?.trim() || undefined,
      description:      (formData.get('description') as string | null)?.trim() || null,
      member_threshold: parseInt((formData.get('member_threshold') as string | null) ?? '0', 10),
      is_active:        formData.get('is_active') === 'true',
      updated_at:       new Date().toISOString(),
    })
    .eq('id', regionId);

  revalidatePath('/regions');
}

// ---------------------------------------------------------------------------
// Platform config (homepage content)
// ---------------------------------------------------------------------------

export async function updatePlatformConfig(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('platform_config')
    .upsert({
      id:                1,
      homepage_headline: (formData.get('homepage_headline') as string | null)?.trim() || '',
      homepage_body:     (formData.get('homepage_body') as string | null)?.trim() || '',
      homepage_cta_text: (formData.get('homepage_cta_text') as string | null)?.trim() || '',
      homepage_cta_url:  (formData.get('homepage_cta_url') as string | null)?.trim() || '',
      updated_at:        new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) {
    console.error('[updatePlatformConfig] error:', error.message);
    redirect('/content?error=1');
  }

  revalidatePath('/content');
  redirect('/content?saved=1');
}
