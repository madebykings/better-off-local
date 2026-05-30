import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Attributes a referral invitation for the authenticated member.
 * Called immediately after sign-up when a referral code was captured from a deep link.
 *
 * Method: POST
 * Auth:   Bearer <member JWT>
 * Body:   { code: string, device_fingerprint?: string }
 *
 * Response 200:
 *   { result: 'ok' | 'not_found' | 'self_referral' | 'already_attributed' }
 *
 * Response 401: missing or invalid JWT
 * Response 400: missing code
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  let code: string | undefined;
  let deviceFingerprint: string | undefined;

  try {
    const body = await req.json();
    code = typeof body?.code === 'string' ? body.code.trim() : undefined;
    deviceFingerprint = typeof body?.device_fingerprint === 'string'
      ? body.device_fingerprint
      : undefined;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (!code) return json({ error: 'code is required' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: result, error: rpcErr } = await supabase.rpc('apply_referral_code', {
    p_invitee_profile_id: user.id,
    p_code: code,
    p_device_fingerprint: deviceFingerprint ?? null,
  });

  if (rpcErr) {
    console.error('[attribute-referral] RPC error:', rpcErr.message);
    return json({ error: 'Failed to attribute referral' }, 500);
  }

  console.log('[attribute-referral] result:', result, { userId: user.id, code });
  return json({ result });
});
