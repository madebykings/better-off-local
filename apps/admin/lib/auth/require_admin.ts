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

  const isAdmin = user.app_metadata?.role === 'admin';

  if (!isAdmin) {
    redirect('/sign-in');
  }

  return { userId: user.id };
}
