import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Unified QR token validator for the retailer scanner.
 *
 * Accepts a raw token string, hashes it, and determines the token type by
 * querying both token tables. The caller does not need to know which type of
 * QR was scanned — the backend resolves it automatically.
 *
 * Token type resolution order:
 *   1. membership_pass_tokens  — membership proof, reusable within TTL
 *   2. redemption_tokens       — offer-specific, single-use
 *
 * ── Membership pass path ────────────────────────────────────────────────────
 * Validates expiry and re-verifies consumer membership is still active at scan
 * time. No consumed_at — the same token can be scanned multiple times within
 * its 5-minute window.
 *
 * ── Offer redemption path ───────────────────────────────────────────────────
 * Delegates entirely to the `redeem_offer_token` Postgres RPC, which performs
 * all validation and writes inside a single transaction:
 *   1. Idempotency check (p_redemption_attempt_id)
 *   2. Correct retailer
 *   3. Token not expired
 *   4. Token not already consumed (SELECT … FOR UPDATE eliminates race)
 *   5. Consumer membership active at scan time
 *   6. Offer live, in date window, correct retailer
 *   7. Offer rules: per-user cap, per-day cap, global cap, cooldown,
 *        valid_days_json, valid_time_start/end
 *   8. UPDATE redemption_tokens SET consumed_at
 *   9. INSERT INTO redemptions (success row)
 *  10. INSERT INTO redemption_attempts (idempotency record)
 * If any step fails the entire transaction rolls back — no orphaned tokens.
 *
 * All business-logic outcomes (approved and rejected) return HTTP 200 with a
 * structured body so the scanner UI always parses the same response shape.
 * 4xx codes are reserved for auth/protocol failures only.
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Request:
 *   POST
 *   Authorization: Bearer <retailer user JWT>
 *   Body: { token: string, redemption_attempt_id?: string }
 *
 * Response 200 — membership pass approved:
 *   { token_type: "membership_pass", valid: true, purpose, plan_interval, member_since }
 *
 * Response 200 — offer redemption approved:
 *   { token_type: "redemption", valid: true, status: "success",
 *     offer_id, retailer_id, offer_title, benefit_text }
 *
 * Response 200 — offer redemption rejected:
 *   { token_type: "redemption", valid: false,
 *     status: "expired" | "rejected" | "membership_invalid" | "rule_blocked",
 *     rejection_reason: string, next_available_at?: string }
 *
 * Response codes (protocol / auth):
 *   400 — missing token in body
 *   401 — missing or invalid JWT
 *   403 — caller is not an active retailer user
 *   404 — token not found in either table
 *   500 — unexpected DB error
 */

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

  // ── 1. Authenticate retailer user ────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  // ── 2. Confirm caller is an active retailer user ─────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: retailerUser } = await supabase
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (!retailerUser) {
    return json({ error: 'Forbidden' }, 403);
  }

  // ── 3. Parse body ────────────────────────────────────────────────────────
  let rawToken: string | undefined;
  let redemptionAttemptId: string | undefined;
  try {
    const body = await req.json();
    rawToken = typeof body?.token === 'string' ? body.token : undefined;
    redemptionAttemptId = typeof body?.redemption_attempt_id === 'string'
      ? body.redemption_attempt_id
      : undefined;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (!rawToken) return json({ error: 'token is required' }, 400);

  const tokenHash = await hashToken(rawToken);

  // ── 4. Try membership_pass_tokens (unchanged) ────────────────────────────
  const { data: passToken } = await supabase
    .from('membership_pass_tokens')
    .select('id, profile_id, purpose, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (passToken) {
    const now = new Date();
    // Membership pass tokens are reusable — no consumed_at check.
    if (new Date(passToken.expires_at) < now) {
      return json({ error: 'Token expired' }, 410);
    }

    // Re-verify membership is still active at scan time.
    // A token issued to a member who subsequently cancels must be rejected.
    const { data: membership } = await supabase
      .from('consumer_memberships')
      .select('plan_interval, started_at')
      .eq('profile_id', passToken.profile_id)
      .in('status', ['active', 'trialing'])
      .gt('current_period_end', now.toISOString())
      .maybeSingle();

    if (!membership) {
      return json({ error: 'Membership not active' }, 403);
    }

    // Fetch first name for the offer-chooser UI (non-critical — omit on error).
    let consumerName: string | null = null;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', passToken.profile_id)
        .maybeSingle();
      if (profile?.full_name) {
        consumerName = (profile.full_name as string).split(' ')[0] ?? null;
      }
    } catch { /* non-critical */ }

    return json({
      token_type: 'membership_pass',
      valid: true,
      purpose: passToken.purpose,
      plan_interval: membership.plan_interval,
      member_since: membership.started_at ?? null,
      consumer_name: consumerName,
    });
  }

  // ── 5. Try redemption_tokens via RPC ─────────────────────────────────────
  // The RPC resolves the token by hash and performs all validation + writes in
  // a single transaction. Passing a stable attempt_id enables idempotent retries.
  const attemptId = redemptionAttemptId ?? crypto.randomUUID();

  // First check the token exists in redemption_tokens so we can return 404 for
  // genuinely unknown tokens rather than an RPC rejection.
  const { data: tokenExists } = await supabase
    .from('redemption_tokens')
    .select('id, profile_id')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (tokenExists) {
    const { data: rpcRows, error: rpcError } = await supabase.rpc('redeem_offer_token', {
      p_token_hash:            tokenHash,
      p_retailer_profile_id:   user.id,
      p_redemption_attempt_id: attemptId,
    });

    if (rpcError) {
      console.error('[RPC_ERROR] redeem_offer_token:', rpcError.message);
      return json({ error: 'Failed to process redemption' }, 500);
    }

    const result = rpcRows?.[0];
    if (!result) {
      console.error('[RPC_ERROR] redeem_offer_token returned no rows');
      return json({ error: 'Failed to process redemption' }, 500);
    }

    // On success, fetch the consumer's first name for staff confirmation.
    let consumerName: string | null = null;
    if (result.valid === true && tokenExists.profile_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', tokenExists.profile_id)
        .maybeSingle();
      if (profile?.full_name) {
        consumerName = profile.full_name.split(' ')[0];
      }
    }

    const response: Record<string, unknown> = {
      token_type:       'redemption',
      valid:            result.valid,
      status:           result.status,
      rejection_reason: result.rejection_reason ?? undefined,
      offer_id:         result.offer_id ?? undefined,
      retailer_id:      result.retailer_id ?? undefined,
      offer_title:      result.offer_title ?? undefined,
      benefit_text:     result.benefit_text ?? undefined,
      next_available_at: result.next_available_at ?? undefined,
      consumer_name:    consumerName ?? undefined,
    };

    return json(response);
  }

  // ── 6. Token not found in either table ───────────────────────────────────
  return json({ error: 'Invalid token' }, 404);
});
