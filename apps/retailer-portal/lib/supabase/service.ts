import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client for trusted server-side operations that must
 * bypass RLS (e.g. redemption validation, webhook processing).
 *
 * NEVER expose this client to the browser. Use only inside server actions,
 * route handlers, or API routes.
 *
 * Required env vars:
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL — project URL (either accepted)
 *   SUPABASE_SERVICE_ROLE_KEY               — service role secret key
 */
export function createServiceClient() {
  return createClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
