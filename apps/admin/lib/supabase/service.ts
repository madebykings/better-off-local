import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client for trusted server-side admin operations.
 * Bypasses RLS for moderation actions, audit logging, and platform management.
 *
 * NEVER expose this client to the browser. Use only inside server actions
 * or server components in the admin portal.
 *
 * Required env vars:
 *   SUPABASE_URL              — project URL
 *   SUPABASE_SERVICE_ROLE_KEY — service role secret key
 */
export function createServiceClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
