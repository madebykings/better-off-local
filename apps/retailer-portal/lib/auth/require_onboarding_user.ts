import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server-side guard for onboarding pages.
 *
 * Lighter than requireRetailerUser — onboarding users are authenticated but
 * may not have a retailer_users record yet. We only verify the session.
 *
 * In a future iteration this will also load the partial retailer record
 * (if one already exists from a previous session) so steps can be pre-filled.
 */
export async function requireOnboardingUser(): Promise<{ userId: string }> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/sign-in');
  }

  return { userId: user.id };
}
