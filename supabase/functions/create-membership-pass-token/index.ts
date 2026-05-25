import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Issues a short-lived membership pass token for the consumer Card tab QR.
 *
 * The token proves active BOL membership. It is NOT tied to a specific offer
 * or retailer. Unlike redemption tokens, pass tokens are NOT single-use —
 * a retailer can re-scan within the TTL without the token being invalidated.
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Request:
 *   POST (no body required)
 *   Authorization: Bearer <consumer JWT>
 *   Body (optional): { device_fingerprint?: string }
 *
 * Response 200:
 *   { token: string, expires_at: string }
 *
 * Response codes:
 *   401 — missing or invalid JWT
 *   403 — no active membership
 *   429 — rate limit exceeded (> 20 tokens in 60 minutes)
 *   500 — DB insert failure
 */

const TOKEN_TTL_MINUTES = 5;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MINUTES = 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  // ── 2. Parse optional body ───────────────────────────────────────────────
  // device_fingerprint is informational only — never gates access.
  let deviceFingerprint: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.device_fingerprint === 'string') {
      deviceFingerprint = body.device_fingerprint;
    }
  } catch {
    // Body is optional — proceed without fingerprint.
  }

  // ── 3. Service-role client for all DB ops ────────────────────────────────
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceRoleKey!,
  );

  // ── 4. Verify consumer has an active membership ──────────────────────────
  const { data: membership, error: membershipError } = await supabase
    .from('consumer_memberships')
    .select('plan_interval, started_at')
    .eq('profile_id', user.id)
    .in('status', ['active', 'trialing'])
    .gt('current_period_end', new Date().toISOString())
    .maybeSingle();

  if (membershipError) {
    console.error('Membership query error:', JSON.stringify(membershipError));
  }

  if (!membership) {
    return json({ error: 'No active membership' }, 403);
  }

  // ── 5. Rate limit: max RATE_LIMIT_MAX tokens per consumer per hour ────────
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();

  const { count } = await supabase
    .from('membership_pass_tokens')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', user.id)
    .gte('created_at', windowStart);

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return json({ error: 'Too many tokens requested. Try again later.' }, 429);
  }

  // ── 6. Generate token: raw UUID + SHA-256 hash ───────────────────────────
  const rawToken = crypto.randomUUID();
  const tokenHash = await hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: insertError } = await supabase
    .from('membership_pass_tokens')
    .insert({
      profile_id: user.id,
      token_hash: tokenHash,
      purpose: 'membership_pass',
      device_fingerprint: deviceFingerprint,
      expires_at: expiresAt,
    });

  if (insertError) {
    console.error('Token insert error:', insertError.message);
    return json({ error: 'Failed to create pass token' }, 500);
  }

  // Return raw token — never persisted, only the hash is stored.
  return json({ token: rawToken, expires_at: expiresAt });
});
