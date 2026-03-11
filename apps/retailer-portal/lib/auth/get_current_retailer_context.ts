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

  // TODO: once retailer_users schema is ready, replace with:
  // const { data } = await supabase
  //   .from('retailer_users')
  //   .select('retailer_id, retailers(name)')
  //   .eq('user_id', user.id)
  //   .single();
  // if (!data) return null;
  // return { userId: user.id, retailerId: data.retailer_id, retailerName: data.retailers.name };

  // Transitional: return basic context until retailer_users table exists.
  return {
    userId: user.id,
    retailerId: '',
    retailerName: '',
  };
}
