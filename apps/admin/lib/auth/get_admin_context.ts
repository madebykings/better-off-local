import { createClient } from '@/lib/supabase/server';

export interface AdminContext {
  userId: string;
  email: string;
}

/**
 * Returns basic admin context for the current session.
 * Used in layouts for populating header/audit context.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return {
    userId: user.id,
    email: user.email ?? '',
  };
}
