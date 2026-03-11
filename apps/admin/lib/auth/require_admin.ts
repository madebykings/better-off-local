import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side guard: ensures the request is from an authenticated admin user.
 * Call at the top of any server component or server action in the admin portal.
 *
 * Admin status is confirmed by checking app_metadata.role (set via service key)
 * OR the profiles table role column. app_metadata is checked first as it
 * requires no additional DB query when present.
 *
 * Redirects to /sign-in if not authenticated or not an admin.
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

  // Fast path: check app_metadata (set via service role key or dashboard).
  if (user.app_metadata?.role === 'admin') {
    return { userId: user.id };
  }

  // Fallback: check profiles table role column.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    redirect('/sign-in');
  }

  return { userId: user.id };
}
