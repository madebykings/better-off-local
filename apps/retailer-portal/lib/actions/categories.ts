'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getStepById, type OnboardingStepId } from '@/lib/onboarding/steps';

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
// Save retailer categories
// ---------------------------------------------------------------------------

/**
 * Replaces the retailer's category selections with the supplied set.
 *
 * Safe to call repeatedly (idempotent): deletes all existing rows for the
 * retailer then inserts the new set in a single batch. The UNIQUE constraint
 * on (retailer_id, category_id) prevents accidental duplicates if the client
 * somehow sends the same ID twice.
 *
 * Advances `onboarding_step` to 'location' only if the retailer is currently
 * on 'categories', preventing regression when the user returns to edit.
 *
 * Returns null on success, { error } on failure.
 */
export async function saveRetailerCategories(
  categoryIds: string[],
): Promise<{ error: string } | null> {
  if (categoryIds.length === 0) {
    return { error: 'Please select at least one category.' };
  }
  if (categoryIds.length > 3) {
    return { error: 'You can select a maximum of 3 categories.' };
  }

  const userId = await getAuthUserId();
  const retailerId = await getRetailerId(userId);

  if (!retailerId) {
    return { error: 'No retailer record found. Please complete the previous steps.' };
  }

  const service = createServiceClient();

  // Read current step before mutating so we know whether to advance.
  const { data: retailer } = await service
    .from('retailers')
    .select('onboarding_step')
    .eq('id', retailerId)
    .single();

  // Delete existing selections.
  const { error: deleteError } = await service
    .from('retailer_categories')
    .delete()
    .eq('retailer_id', retailerId);

  if (deleteError) {
    console.error('[saveRetailerCategories] delete error:', deleteError.message);
    return { error: 'Failed to save categories. Please try again.' };
  }

  // Insert the new set.
  const rows = categoryIds.map((categoryId) => ({
    retailer_id: retailerId,
    category_id: categoryId,
  }));

  const { error: insertError } = await service
    .from('retailer_categories')
    .insert(rows);

  if (insertError) {
    console.error('[saveRetailerCategories] insert error:', insertError.message);
    return { error: 'Failed to save categories. Please try again.' };
  }

  // Advance step only if currently on 'categories'.
  if (retailer?.onboarding_step === 'categories') {
    const locationStep = getStepById('location' as OnboardingStepId);
    if (locationStep) {
      await service
        .from('retailers')
        .update({ onboarding_step: 'location', updated_at: new Date().toISOString() })
        .eq('id', retailerId);
    }
  }

  return null;
}
