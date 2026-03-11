import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side guard: ensures the request is from an authenticated retailer user
 * with an active link in the retailer_users table.
 * Call at the top of any server component or server action that needs protection.
 *
 * Returns the authenticated user ID and linked retailer ID.
 * Redirects to /sign-in if not authenticated or not linked to a retailer.
 */
export async function requireRetailerUser(): Promise<{
  userId: string;
  retailerId: string;
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
    .select('retailer_id')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .single();

  if (!retailerUser) {
    redirect('/sign-in');
  }

  return { userId: user.id, retailerId: retailerUser.retailer_id };
}
