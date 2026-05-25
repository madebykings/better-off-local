import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type RetailerAccessRole = 'owner' | 'manager' | 'staff' | 'scanner_only';

/**
 * Server-side guard: ensures the request is from an authenticated retailer user
 * with an active link in the retailer_users table.
 * Call at the top of any server component or server action that needs protection.
 *
 * Returns the authenticated user ID, linked retailer ID, and access role.
 * Redirects to /sign-in if not authenticated or not linked to a retailer.
 */
export async function requireRetailerUser(): Promise<{
  userId: string;
  retailerId: string;
  accessRole: RetailerAccessRole;
}> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/sign-in');
  }

  const { data: retailerUser } = await supabase
    .from('retailer_users')
    .select('retailer_id, access_role')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .single();

  if (!retailerUser) {
    // Redirect to onboarding rather than sign-in — the user is authenticated
    // but not yet linked to a retailer. Sending them back to sign-in would
    // create a redirect loop because middleware sends authenticated sessions
    // straight back to /dashboard.
    redirect('/onboarding');
  }

  return {
    userId: user.id,
    retailerId: retailerUser.retailer_id,
    accessRole: retailerUser.access_role as RetailerAccessRole,
  };
}
