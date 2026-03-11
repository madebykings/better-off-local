import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side guard: ensures the request is from an authenticated admin user.
 * Call at the top of any server component or server action in the admin portal.
 *
 * Admin status is checked via a role claim or admin_users table — never trust
 * client-side data for this check.
 *
 * Redirects to /sign-in if not authenticated.
 * Throws if user is not an admin.
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/sign-in');
  }

  // TODO: verify admin role via JWT claim or admin_users table
  // Option A: JWT app_metadata claim
  // const isAdmin = user.app_metadata?.role === 'admin';
  //
  // Option B: admin_users table
  // const { data: adminUser } = await supabase
  //   .from('admin_users')
  //   .select('id')
  //   .eq('user_id', user.id)
  //   .single();
  // const isAdmin = !!adminUser;
  //
  // if (!isAdmin) throw new Error('Access denied: not an admin');

  // Placeholder until auth strategy is decided:
  throw new Error('requireAdmin: not yet implemented — add admin role check');
}
