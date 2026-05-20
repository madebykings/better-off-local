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
 * Performs all validation in a single call, in order:
 *   1. Confirm caller is linked to the same retailer as the token
 *   2. Check token not expired
 *   3. Check token not already consumed
 *   4. Re-verify consumer membership is active/trialing and within period
 *   5. Re-verify offer is live, belongs to the retailer, within date window
 *   6. Re-validate offer rules at scan time:
 *        max_redemptions_per_user, max_redemptions_per_day,
 *        max_redemptions_total, cooldown_hours,
 *        valid_days_json, valid_time_start/end
 *   7. Atomically consume token (UPDATE WHERE consumed_at IS NULL + .select())
 *   8. Insert redemptions row (success or log rejection)
 *   9. Return structured result
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
 *   Body: { token: string }
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

  // ── 3. Parse token from body ─────────────────────────────────────────────
  let rawToken: string | undefined;
  try {
    const body = await req.json();
    rawToken = typeof body?.token === 'string' ? body.token : undefined;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }
  if (!rawToken) return json({ error: 'token is required' }, 400);

  const tokenHash = await hashToken(rawToken);
  const now = new Date();

  // ── 4. Try membership_pass_tokens (unchanged) ────────────────────────────
  const { data: passToken } = await supabase
    .from('membership_pass_tokens')
    .select('id, profile_id, purpose, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (passToken) {
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

    return json({
      token_type: 'membership_pass',
      valid: true,
      purpose: passToken.purpose,
      plan_interval: membership.plan_interval,
      member_since: membership.started_at ?? null,
    });
  }

  // ── 5. Try redemption_tokens ─────────────────────────────────────────────
  const { data: redemptionToken } = await supabase
    .from('redemption_tokens')
    .select('id, profile_id, offer_id, retailer_id, retailer_location_id, expires_at, consumed_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (redemptionToken) {
    // ── Guard 1: Correct retailer ──────────────────────────────────────────
    // Prevents retailer A scanning tokens issued for retailer B's offers.
    if (redemptionToken.retailer_id !== retailerUser.retailer_id) {
      return json({
        token_type: 'redemption',
        valid: false,
        status: 'rejected',
        rejection_reason: 'This QR code was not issued for your retailer.',
      });
    }

    // ── Guard 2: Token not expired ─────────────────────────────────────────
    if (new Date(redemptionToken.expires_at) < now) {
      return json({
        token_type: 'redemption',
        valid: false,
        status: 'expired',
        rejection_reason: 'QR code has expired. Ask the member to refresh.',
      });
    }

    // ── Guard 3: Not already consumed ─────────────────────────────────────
    if (redemptionToken.consumed_at) {
      return json({
        token_type: 'redemption',
        valid: false,
        status: 'rejected',
        rejection_reason: 'This QR code has already been used.',
      });
    }

    // Helper: log a rejected redemption attempt for audit.
    // Called after retailer ownership is confirmed (guards 1–3 pass).
    const logRejection = async (status: string, reason: string) => {
      const { error } = await supabase.from('redemptions').insert({
        profile_id: redemptionToken.profile_id,
        retailer_id: redemptionToken.retailer_id,
        retailer_location_id: redemptionToken.retailer_location_id ?? null,
        offer_id: redemptionToken.offer_id,
        redemption_token_id: redemptionToken.id,
        status,
        rejection_reason: reason,
        validated_by_profile_id: user.id,
      });
      if (error) console.error('Rejection log insert error:', error.message);
    };

    // ── Guard 4: Consumer membership active at scan time ──────────────────
    // Re-checked here because a member may have cancelled after the token
    // was issued. The token alone is not sufficient proof of entitlement.
    const { data: membership } = await supabase
      .from('consumer_memberships')
      .select('id')
      .eq('profile_id', redemptionToken.profile_id)
      .in('status', ['active', 'trialing'])
      .gt('current_period_end', now.toISOString())
      .maybeSingle();

    if (!membership) {
      await logRejection('membership_invalid', 'Consumer membership is not active.');
      return json({
        token_type: 'redemption',
        valid: false,
        status: 'membership_invalid',
        rejection_reason: 'This member does not have an active membership.',
      });
    }

    // ── Guard 5: Offer still live ──────────────────────────────────────────
    // Re-checked at scan time because an offer may have been paused, expired,
    // or ended after the token was issued.
    const { data: offer } = await supabase
      .from('offers')
      .select('id, title, value_text, status, retailer_id, start_at, end_at')
      .eq('id', redemptionToken.offer_id)
      .maybeSingle();

    const offerInvalid =
      !offer ||
      offer.status !== 'live' ||
      offer.retailer_id !== redemptionToken.retailer_id ||
      (offer.start_at && new Date(offer.start_at) > now) ||
      (offer.end_at && new Date(offer.end_at) < now);

    if (offerInvalid) {
      await logRejection('rejected', 'Offer is no longer available.');
      return json({
        token_type: 'redemption',
        valid: false,
        status: 'rejected',
        rejection_reason: 'This offer is no longer available.',
      });
    }

    // ── Guard 6: Offer rules re-validated at scan time ────────────────────
    // Rules are checked at token creation too, but re-validated here to catch
    // the case where two tokens were issued in quick succession (both would
    // pass at creation time but only one should be honoured).
    const { data: rules } = await supabase
      .from('offer_rules')
      .select('*')
      .eq('offer_id', redemptionToken.offer_id)
      .maybeSingle();

    if (rules) {
      // Per-user lifetime cap
      if (rules.max_redemptions_per_user != null) {
        const { count } = await supabase
          .from('redemptions')
          .select('*', { count: 'exact', head: true })
          .eq('offer_id', redemptionToken.offer_id)
          .eq('profile_id', redemptionToken.profile_id)
          .eq('status', 'success');

        if ((count ?? 0) >= rules.max_redemptions_per_user) {
          await logRejection('rule_blocked', 'Per-user redemption limit reached.');
          return json({
            token_type: 'redemption',
            valid: false,
            status: 'rule_blocked',
            rejection_reason: 'This member has already used this offer the maximum number of times.',
          });
        }
      }

      // Per-user per-day cap
      if (rules.max_redemptions_per_day != null) {
        const todayStart = new Date(now);
        todayStart.setUTCHours(0, 0, 0, 0);

        const { count } = await supabase
          .from('redemptions')
          .select('*', { count: 'exact', head: true })
          .eq('offer_id', redemptionToken.offer_id)
          .eq('profile_id', redemptionToken.profile_id)
          .eq('status', 'success')
          .gte('redeemed_at', todayStart.toISOString());

        if ((count ?? 0) >= rules.max_redemptions_per_day) {
          const nextAvailableAt = new Date(todayStart);
          nextAvailableAt.setUTCDate(nextAvailableAt.getUTCDate() + 1);

          await logRejection('rule_blocked', 'Daily redemption limit reached.');
          return json({
            token_type: 'redemption',
            valid: false,
            status: 'rule_blocked',
            rejection_reason: 'This member has already used this offer today.',
            next_available_at: nextAvailableAt.toISOString(),
          });
        }
      }

      // Global total cap across all users
      if (rules.max_redemptions_total != null) {
        const { count } = await supabase
          .from('redemptions')
          .select('*', { count: 'exact', head: true })
          .eq('offer_id', redemptionToken.offer_id)
          .eq('status', 'success');

        if ((count ?? 0) >= rules.max_redemptions_total) {
          await logRejection('rule_blocked', 'Offer total redemption cap reached.');
          return json({
            token_type: 'redemption',
            valid: false,
            status: 'rule_blocked',
            rejection_reason: 'This offer has reached its total redemption limit.',
          });
        }
      }

      // Cooldown period between redemptions for the same user
      if (rules.cooldown_hours != null) {
        const { data: lastRedemption } = await supabase
          .from('redemptions')
          .select('redeemed_at')
          .eq('offer_id', redemptionToken.offer_id)
          .eq('profile_id', redemptionToken.profile_id)
          .eq('status', 'success')
          .order('redeemed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastRedemption) {
          const cooldownEndsAt = new Date(lastRedemption.redeemed_at);
          cooldownEndsAt.setTime(
            cooldownEndsAt.getTime() + rules.cooldown_hours * 60 * 60 * 1000,
          );

          if (cooldownEndsAt > now) {
            await logRejection('rule_blocked', 'Cooldown period not yet elapsed.');
            return json({
              token_type: 'redemption',
              valid: false,
              status: 'rule_blocked',
              rejection_reason: 'This member must wait before using this offer again.',
              next_available_at: cooldownEndsAt.toISOString(),
            });
          }
        }
      }

      // Valid days of the week — e.g. ["mon","tue","wed","thu","fri"]
      if (rules.valid_days_json != null) {
        const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const todayName = dayNames[now.getUTCDay()];
        const validDays = rules.valid_days_json as string[];

        if (!validDays.includes(todayName)) {
          const dayLabel = todayName[0].toUpperCase() + todayName.slice(1);
          await logRejection('rule_blocked', `Offer not valid on ${dayLabel}s.`);
          return json({
            token_type: 'redemption',
            valid: false,
            status: 'rule_blocked',
            rejection_reason: `This offer is not available on ${dayLabel}s.`,
          });
        }
      }

      // Valid time window — "HH:MM:SS" strings; compared lexicographically
      if (rules.valid_time_start != null && rules.valid_time_end != null) {
        const pad = (n: number) => String(n).padStart(2, '0');
        const currentTime = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;

        if (currentTime < rules.valid_time_start || currentTime > rules.valid_time_end) {
          const start = (rules.valid_time_start as string).substring(0, 5);
          const end = (rules.valid_time_end as string).substring(0, 5);
          await logRejection('rule_blocked', `Offer only valid ${start}–${end} UTC.`);
          return json({
            token_type: 'redemption',
            valid: false,
            status: 'rule_blocked',
            rejection_reason: `This offer is only valid between ${start} and ${end} (UTC).`,
          });
        }
      }
    }

    // ── Step 7: Atomically consume token ──────────────────────────────────
    // .select() returns the updated row if the WHERE clause matched.
    // An empty result means another concurrent scan consumed the token first.
    const { data: consumed, error: consumeError } = await supabase
      .from('redemption_tokens')
      .update({ consumed_at: now.toISOString() })
      .eq('id', redemptionToken.id)
      .is('consumed_at', null)
      .select('id');

    if (consumeError) {
      console.error('Token consume error:', consumeError.message);
      return json({ error: 'Failed to process redemption' }, 500);
    }

    if (!consumed || consumed.length === 0) {
      // Race condition: another scan consumed this token between our read and write.
      return json({
        token_type: 'redemption',
        valid: false,
        status: 'rejected',
        rejection_reason: 'This QR code has already been used.',
      });
    }

    // ── Step 8: Insert redemption record ──────────────────────────────────
    //
    // TODO [LAUNCH BLOCKER]: Steps 7 and 8 must become a single atomic Postgres
    // RPC transaction before going to production. Currently there is a window
    // where the token is consumed (consumed_at set) but the redemptions insert
    // fails, leaving a permanently consumed token with no record. The member
    // must generate a new QR and retry, and the event must be manually reconciled.
    //
    // Implement a `redeem_offer_token(token_hash, retailer_user_id)` Postgres
    // function that does UPDATE + INSERT in one transaction, and call it here
    // via supabase.rpc(). See docs/implementation/04-redemption-engine.md.
    const { error: insertError } = await supabase
      .from('redemptions')
      .insert({
        profile_id: redemptionToken.profile_id,
        retailer_id: redemptionToken.retailer_id,
        retailer_location_id: redemptionToken.retailer_location_id ?? null,
        offer_id: redemptionToken.offer_id,
        redemption_token_id: redemptionToken.id,
        status: 'success',
        validated_by_profile_id: user.id,
      });

    if (insertError) {
      // Token is consumed but the record insert failed.
      // Log conspicuously for manual reconciliation — include all IDs needed
      // to reconstruct the redemption record if required.
      console.error(
        '[REDEMPTION_INSERT_FAILED]',
        'token_id:', redemptionToken.id,
        '| offer_id:', redemptionToken.offer_id,
        '| retailer_id:', redemptionToken.retailer_id,
        '| profile_id:', redemptionToken.profile_id,
        '| error:', insertError.message,
      );

      // Return an error rather than silently approving. Ledger accuracy is more
      // important than avoiding a retry at the counter for MVP. The member's
      // current QR is permanently consumed; they must generate a new one.
      return json({
        token_type: 'redemption',
        valid: false,
        status: 'server_error',
        rejection_reason: 'server_error',
        message: "We couldn't record this redemption. Please try again.",
      });
    }

    // ── Step 9: Return approved result ────────────────────────────────────
    return json({
      token_type: 'redemption',
      valid: true,
      status: 'success',
      offer_id: redemptionToken.offer_id,
      retailer_id: redemptionToken.retailer_id,
      offer_title: offer.title,
      benefit_text: offer.value_text ?? null,
    });
  }

  // ── 6. Token not found in either table ───────────────────────────────────
  return json({ error: 'Invalid token' }, 404);
});
