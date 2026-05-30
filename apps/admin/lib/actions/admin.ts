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
