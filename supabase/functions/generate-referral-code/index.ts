import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Lazily generates (or returns) a referral code for the authenticated member.
 *
 * Method: POST (no body required)
 * Auth:   Bearer <member JWT>
 *
 * Response 200:
 *   { code: string, referral_url: string }
 *
 * Response 401: missing or invalid JWT
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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: code, error: rpcErr } = await supabase.rpc('generate_referral_code', {
    p_profile_id: user.id,
  });

  if (rpcErr) {
    console.error('[generate-referral-code] RPC error:', rpcErr.message);
    return json({ error: 'Failed to generate code' }, 500);
  }

  const appScheme = Deno.env.get('APP_SCHEME') ?? 'betterofflocal';
  const domain = Deno.env.get('APP_UNIVERSAL_LINK_DOMAIN');
  const referralUrl = domain
    ? `https://${domain}/join?ref=${code}`
    : `${appScheme}://join?ref=${code}`;

  return json({ code, referral_url: referralUrl });
});
