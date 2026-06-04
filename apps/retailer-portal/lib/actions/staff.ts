'use server';

import { revalidatePath } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';

export type StaffActionState = { error: string | null; success?: boolean } | null;

/**
 * Remove a staff member from the retailer.
 *
 * Sets is_active = false so they can no longer log in as staff.
 * Does not delete the auth user.
 */
export async function removeStaff(staffId: string): Promise<StaffActionState> {
  const { retailerId, accessRole } = await requireRetailerUser();

  if (accessRole === 'scanner_only' || accessRole === 'staff') {
    return { error: 'Only owners and managers can remove staff.' };
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('retailer_users')
    .update({ is_active: false })
    .eq('id', staffId)
    .eq('retailer_id', retailerId) // scope to this retailer
    .eq('access_role', 'scanner_only'); // only remove scanner_only via this action

  if (error) {
    console.error('removeStaff error:', error.message);
    return { error: 'Could not remove staff member. Please try again.' };
  }

  revalidatePath('/team');
  return { error: null, success: true };
}
