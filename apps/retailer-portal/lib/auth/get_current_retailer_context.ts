import { createClient } from '@/lib/supabase/server';

export interface RetailerContext {
  userId: string;
  retailerId: string;
  retailerName: string;
}

/**
 * Returns the current retailer context for the authenticated user.
 * Returns null if the user has no linked retailer.
 * Used in layouts to populate sidebar and header with retailer info.
 */
export async function getCurrentRetailerContext(): Promise<RetailerContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('retailer_users')
    .select('retailer_id, retailers(name)')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .single();

  if (!data) return null;

  const retailerName =
    Array.isArray(data.retailers)
      ? (data.retailers[0]?.name ?? '')
      : (data.retailers as { name: string } | null)?.name ?? '';

  return {
    userId: user.id,
    retailerId: data.retailer_id,
    retailerName,
  };
}
