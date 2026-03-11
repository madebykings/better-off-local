import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN_TTL_MINUTES = 5;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** SHA-256 hex digest of a string. */
async function hashToken(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // ── 1. Authenticate consumer ────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let offerId: string | undefined;
  try {
    const body = await req.json();
    offerId = body?.offer_id as string | undefined;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (!offerId) return json({ error: 'offer_id is required' }, 400);

  // ── 3. Service-role client for all DB writes/checks ──────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── 4. Verify consumer has an active membership ──────────────────────────
  const { data: membership } = await supabase
    .from('consumer_memberships')
    .select('id')
    .eq('profile_id', user.id)
    .in('status', ['active', 'trialing'])
    .gt('current_period_end', new Date().toISOString())
    .maybeSingle();

  if (!membership) {
    return json({ error: 'No active membership' }, 403);
  }

  // ── 5. Verify offer exists and is live ───────────────────────────────────
  const { data: offer } = await supabase
    .from('offers')
    .select('id, retailer_id, retailer_location_id, status, end_at')
    .eq('id', offerId)
    .eq('status', 'live')
    .maybeSingle();

  if (!offer) {
    return json({ error: 'Offer not found or not live' }, 404);
  }

  if (offer.end_at && new Date(offer.end_at) < new Date()) {
    return json({ error: 'Offer has ended' }, 410);
  }

  // ── 6. Check offer rules (caps) ──────────────────────────────────────────
  const { data: rules } = await supabase
    .from('offer_rules')
    .select('max_redemptions_total, max_redemptions_per_user, max_redemptions_per_day')
    .eq('offer_id', offerId)
    .maybeSingle();

  if (rules) {
    // Per-user cap
    if (rules.max_redemptions_per_user != null) {
      const { count } = await supabase
        .from('redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('offer_id', offerId)
        .eq('profile_id', user.id)
        .eq('status', 'success');

      if ((count ?? 0) >= rules.max_redemptions_per_user) {
        return json({ error: 'Per-user redemption limit reached for this offer' }, 429);
      }
    }

    // Global cap
    if (rules.max_redemptions_total != null) {
      const { count } = await supabase
        .from('redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('offer_id', offerId)
        .eq('status', 'success');

      if ((count ?? 0) >= rules.max_redemptions_total) {
        return json({ error: 'Offer redemption cap reached' }, 410);
      }
    }

    // Per-day cap (UTC day)
    if (rules.max_redemptions_per_day != null) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('offer_id', offerId)
        .eq('profile_id', user.id)
        .eq('status', 'success')
        .gte('redeemed_at', todayStart.toISOString());

      if ((count ?? 0) >= rules.max_redemptions_per_day) {
        return json({ error: 'Daily redemption limit reached for this offer' }, 429);
      }
    }
  }

  // ── 7. Generate token: raw UUID + SHA-256 hash ───────────────────────────
  const rawToken = crypto.randomUUID();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: insertError } = await supabase
    .from('redemption_tokens')
    .insert({
      profile_id: user.id,
      offer_id: offerId,
      retailer_id: offer.retailer_id,
      retailer_location_id: offer.retailer_location_id ?? null,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

  if (insertError) {
    console.error('Token insert error:', insertError.message);
    return json({ error: 'Failed to create redemption token' }, 500);
  }

  // Return raw token — never persisted, only the hash is stored.
  return json({
    token: rawToken,
    offer_id: offerId,
    retailer_id: offer.retailer_id,
    expires_at: expiresAt,
  });
});
