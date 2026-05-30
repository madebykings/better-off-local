'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

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
