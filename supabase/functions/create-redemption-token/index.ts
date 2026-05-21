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

/**
 * Maps an availability_state returned by get_offer_availability to the
 * error response sent to the Flutter client.
 *
 * error_codes for states that the Flutter RedemptionController already
 * handles by name are preserved exactly:
 *   requires_membership → membership_required
 *   offer_expired       → offer_ended
 *   total_cap_reached   → global_cap
 *   lifetime_used       → lifetime_limit
 *   daily_cap_reached   → daily_limit
 *   retailer_inactive   → offer_unavailable
 *
 * New states use the availability_state value as error_code. Flutter's
 * controller falls back to HTTP status for unrecognised codes:
 *   429 → "Redemption limit reached for this offer."
 *   404 → "This offer is no longer available."
 *   422 → generic retriable error (day/time/new_customers — UI gate prevents
 *          reaching here in normal flow)
 */
function mapAvailabilityState(state: string): {
  error: string;
  error_code: string;
  httpStatus: number;
} {
  switch (state) {
    // ── Membership ───────────────────────────────────────────────────────────
    case 'requires_membership':
      return {
        error: 'No active membership',
        error_code: 'membership_required',
        httpStatus: 403,
      };

    // ── Offer lifecycle ──────────────────────────────────────────────────────
    case 'offer_expired':
      return {
        error: 'Offer has ended',
        error_code: 'offer_ended',
        httpStatus: 410,
      };
    case 'offer_not_started':
      return {
        error: 'Offer is not yet available',
        error_code: 'offer_not_started',
        httpStatus: 422,
      };

    // ── Caps ─────────────────────────────────────────────────────────────────
    case 'total_cap_reached':
      return {
        error: 'Offer redemption cap reached',
        error_code: 'global_cap',
        httpStatus: 410,
      };
    case 'lifetime_used':
      return {
        error: 'Per-user redemption limit reached for this offer',
        error_code: 'lifetime_limit',
        httpStatus: 429,
      };
    case 'daily_cap_reached':
      return {
        error: 'Daily redemption limit reached for this offer',
        error_code: 'daily_limit',
        httpStatus: 429,
      };
    case 'retailer_daily_cap_reached':
      return {
        error: 'Daily retailer offer limit reached',
        error_code: 'retailer_daily_cap_reached',
        httpStatus: 429,
      };
    case 'cooldown':
      return {
        error: 'Must wait before redeeming this offer again',
        error_code: 'cooldown',
        httpStatus: 429,
      };

    // ── Scheduling ───────────────────────────────────────────────────────────
    case 'day_restricted':
      return {
        error: 'Offer not available on this day',
        error_code: 'day_restricted',
        httpStatus: 422,
      };
    case 'time_restricted':
      return {
        error: 'Offer not available at this time',
        error_code: 'time_restricted',
        httpStatus: 422,
      };

    // ── Eligibility ──────────────────────────────────────────────────────────
    case 'new_customers_only':
      return {
        error: 'Offer is for new customers only',
        error_code: 'new_customers_only',
        httpStatus: 422,
      };

    // ── Retailer / fallback ──────────────────────────────────────────────────
    case 'retailer_inactive':
    default:
      return {
        error: 'Offer not found or not available',
        error_code: 'offer_unavailable',
        httpStatus: 404,
      };
  }
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

  // ── 1. Authenticate consumer ──────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let offerId: string | undefined;
  try {
    const body = await req.json();
    offerId = body?.offer_id as string | undefined;
  } catch {
    return json({ error: 'Invalid request body', error_code: 'server_error' }, 400);
  }
  if (!offerId) return json({ error: 'offer_id is required', error_code: 'server_error' }, 400);

  // ── 3. Service-role client (token insert + offer metadata fetch) ──────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── 4. Server-authoritative availability check ────────────────────────────
  // get_offer_availability enforces all rules in one call:
  //   - retailer live (visibility_status, is_active, subscription)
  //   - offer lifecycle (status, start_at, end_at)
  //   - caps (total, per-user lifetime, per-user daily, retailer daily)
  //   - cooldown_hours
  //   - valid_days_json, valid_time_start/end
  //   - new_customers_only
  //   - consumer membership
  //
  // Called on the authenticated client — function is SECURITY DEFINER and
  // granted to the authenticated role.
  const { data: availabilityRows, error: availabilityError } = await supabaseUser
    .rpc('get_offer_availability', {
      p_offer_id: offerId,
      p_consumer_id: user.id,
    });

  if (availabilityError) {
    console.error('Availability RPC error:', availabilityError.message);
    return json({ error: 'Failed to check offer availability', error_code: 'server_error' }, 500);
  }

  // Empty result set: offer not found or retailer not in the system.
  if (!availabilityRows || availabilityRows.length === 0) {
    return json({ error: 'Offer not found or not available', error_code: 'offer_unavailable' }, 404);
  }

  const availabilityState: string = availabilityRows[0].availability_state;

  if (availabilityState !== 'available') {
    const { error: errMsg, error_code, httpStatus } = mapAvailabilityState(availabilityState);
    return json({ error: errMsg, error_code }, httpStatus);
  }

  // ── 5. Fetch offer metadata for token insert ──────────────────────────────
  // Availability RPC confirmed the offer is live; this fetch is solely to
  // obtain retailer_id and retailer_location_id for the token row.
  const { data: offer, error: offerError } = await supabase
    .from('offers')
    .select('retailer_id, retailer_location_id')
    .eq('id', offerId)
    .eq('status', 'live')
    .maybeSingle();

  if (offerError || !offer) {
    // Should not happen — availability RPC confirmed available moments ago.
    console.error('Offer metadata fetch failed after availability check passed:', offerId, offerError?.message);
    return json({ error: 'Failed to create redemption token', error_code: 'server_error' }, 500);
  }

  // ── 6. Generate token: raw UUID + SHA-256 hash ────────────────────────────
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
    return json({ error: 'Failed to create redemption token', error_code: 'server_error' }, 500);
  }

  // Return raw token — never persisted, only the hash is stored.
  return json({
    token: rawToken,
    offer_id: offerId,
    retailer_id: offer.retailer_id,
    expires_at: expiresAt,
  });
});
