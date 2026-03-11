import { createClient } from '@/lib/supabase/server';

export interface AdminContext {
  userId: string;
  email: string;
  fullName: string | null;
}

/**
 * Returns admin context for the current session.
 * Used in layouts for populating header and audit context.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  return {
    userId: user.id,
    email: user.email ?? '',
    fullName: profile?.full_name ?? null,
  };
}
