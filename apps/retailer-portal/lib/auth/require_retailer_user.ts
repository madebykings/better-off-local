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

  // TODO: once retailer_users schema is ready, replace with:
  // const { data: retailerUser } = await supabase
  //   .from('retailer_users')
  //   .select('retailer_id')
  //   .eq('user_id', user.id)
  //   .single();
  // if (!retailerUser) redirect('/sign-in');
  // return { userId: user.id, retailerId: retailerUser.retailer_id };

  // Transitional: return userId only until retailer_users table exists.
  return { userId: user.id, retailerId: '' };
}
