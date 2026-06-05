import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * process-event-reminders
 *
 * HTTP trigger alternative to pg_cron for environments where pg_cron is not
 * available. Calls process_event_reminders() which sends 24h and 1h pre-event
 * in-app notifications to opted-in members.
 *
 * Authorization: service-role key only (Bearer <SUPABASE_SERVICE_ROLE_KEY>).
 *
 * Response body (JSON):
 *   { processed: true }
 *
 * Env vars required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  // ── Auth: service-role only ───────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // ── Invoke RPC ────────────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { error } = await supabase.rpc('process_event_reminders');

  if (error) {
    console.error('[process-event-reminders] rpc error', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ processed: true }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
