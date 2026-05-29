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
