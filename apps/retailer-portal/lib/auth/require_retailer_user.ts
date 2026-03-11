import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side guard: ensures the request is from an authenticated retailer user.
 * Call at the top of any server component or server action that needs protection.
 *
 * Returns the authenticated user ID and linked retailer ID.
 * Redirects to /sign-in if not authenticated.
 * Throws if user has no linked retailer (access denied).
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

  // TODO: query retailer_users table to get linked retailer_id
  // const { data: retailerUser } = await supabase
  //   .from('retailer_users')
  //   .select('retailer_id')
  //   .eq('user_id', user.id)
  //   .single();

  // if (!retailerUser) throw new Error('Access denied: no linked retailer');

  // return { userId: user.id, retailerId: retailerUser.retailer_id };

  // Placeholder until schema is ready:
  throw new Error('requireRetailerUser: not yet implemented — add retailer_users query');
}
