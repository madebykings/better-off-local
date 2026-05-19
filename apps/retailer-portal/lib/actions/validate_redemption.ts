'use server';

import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';

export type RedemptionStatus =
  | 'success'
  | 'rejected'
  | 'expired'
  | 'rule_blocked'
  | 'membership_invalid'
  | 'server_error';

export interface RedemptionResult {
  success: boolean;
  status: RedemptionStatus;
  offerTitle?: string;
  memberName?: string;
  rejectionReason?: string;
}

/** SHA-256 hex digest — mirrors the hash used in create-redemption-token. */
async function hashToken(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Server action: validates a scanned QR token and records the redemption.
 *
 * Checks (in order):
 * 1. Token exists in DB
 * 2. Token not expired
 * 3. Token belongs to this retailer
 * 4. Consumer membership still active
 * 5. Offer still live
 * 6. Offer rules (per-user, per-day, global caps)
 * 7. Atomic token consumption — UPDATE WHERE consumed_at IS NULL RETURNING id.
 *    This is the true single-use gate. If 0 rows are returned, a concurrent
 *    request consumed the token between our lookup and this write.
 *
 * On success: inserts success redemption record.
 * On failure: inserts a failure redemption record (with context) and returns reason.
 *
 * Callers must be authenticated retailer users — enforced via requireRetailerUser().
 */
export async function validateRedemption(rawToken: string): Promise<RedemptionResult> {
  const { userId, retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const tokenHash = await hashToken(rawToken.trim());

  // ── Look up token ────────────────────────────────────────────────────────
  const { data: token } = await supabase
    .from('redemption_tokens')
    .select('id, profile_id, offer_id, retailer_id, retailer_location_id, expires_at, consumed_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  /** Log a failed redemption attempt. Only callable when we have a token row. */
  const logFailure = async (
    status: Exclude<RedemptionStatus, 'success'>,
    reason: string,
  ) => {
    if (!token) return;
    await supabase.from('redemptions').insert({
      profile_id: token.profile_id,
      retailer_id: retailerId,
      retailer_location_id: token.retailer_location_id ?? null,
      offer_id: token.offer_id,
      redemption_token_id: token.id,
      status,
      rejection_reason: reason,
      validated_by_profile_id: userId,
      redeemed_at: new Date().toISOString(),
    });
  };

  // ── Token not found ──────────────────────────────────────────────────────
  if (!token) {
    // Cannot log — no profile_id or offer_id available.
    return { success: false, status: 'rejected', rejectionReason: 'Invalid QR code' };
  }

  // ── Early exit for obviously consumed tokens (optimisation only — the true
  //    single-use gate is the atomic UPDATE at the end of this function).
  if (token.consumed_at) {
    await logFailure('rejected', 'Token already used');
    return { success: false, status: 'rejected', rejectionReason: 'This QR code has already been used' };
  }

  // ── Expired ───────────────────────────────────────────────────────────────
  if (new Date(token.expires_at) < new Date()) {
    await logFailure('expired', 'Token expired');
    return { success: false, status: 'expired', rejectionReason: 'QR code has expired — ask the member to generate a new one' };
  }

  // ── Retailer mismatch ─────────────────────────────────────────────────────
  if (token.retailer_id !== retailerId) {
    await logFailure('rejected', 'Retailer mismatch');
    return { success: false, status: 'rejected', rejectionReason: 'QR code is not valid for this retailer' };
  }

  // ── Consumer membership still active ─────────────────────────────────────
  const { data: membership } = await supabase
    .from('consumer_memberships')
    .select('id')
    .eq('profile_id', token.profile_id)
    .in('status', ['active', 'trialing'])
    .gt('current_period_end', new Date().toISOString())
    .maybeSingle();

  if (!membership) {
    await logFailure('membership_invalid', 'Consumer membership not active');
    return { success: false, status: 'membership_invalid', rejectionReason: 'Member does not have an active subscription' };
  }

  // ── Offer still live ─────────────────────────────────────────────────────
  const { data: offer } = await supabase
    .from('offers')
    .select('id, title, status, end_at')
    .eq('id', token.offer_id)
    .maybeSingle();

  if (!offer || offer.status !== 'live') {
    await logFailure('rejected', 'Offer not live');
    return { success: false, status: 'rejected', rejectionReason: 'This offer is no longer available' };
  }

  if (offer.end_at && new Date(offer.end_at) < new Date()) {
    await logFailure('rejected', 'Offer ended');
    return { success: false, status: 'rejected', rejectionReason: 'This offer has ended' };
  }

  // ── Offer rules ───────────────────────────────────────────────────────────
  const { data: rules } = await supabase
    .from('offer_rules')
    .select('max_redemptions_total, max_redemptions_per_user, max_redemptions_per_day')
    .eq('offer_id', token.offer_id)
    .maybeSingle();

  if (rules) {
    // Per-user cap
    if (rules.max_redemptions_per_user != null) {
      const { count } = await supabase
        .from('redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('offer_id', token.offer_id)
        .eq('profile_id', token.profile_id)
        .eq('status', 'success');

      if ((count ?? 0) >= rules.max_redemptions_per_user) {
        await logFailure('rule_blocked', 'Per-user redemption limit reached');
        return { success: false, status: 'rule_blocked', rejectionReason: 'Member has already redeemed this offer the maximum number of times' };
      }
    }

    // Global cap
    if (rules.max_redemptions_total != null) {
      const { count } = await supabase
        .from('redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('offer_id', token.offer_id)
        .eq('status', 'success');

      if ((count ?? 0) >= rules.max_redemptions_total) {
        await logFailure('rule_blocked', 'Global redemption cap reached');
        return { success: false, status: 'rule_blocked', rejectionReason: 'This offer has reached its maximum number of redemptions' };
      }
    }

    // Per-day cap (UTC)
    if (rules.max_redemptions_per_day != null) {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('offer_id', token.offer_id)
        .eq('profile_id', token.profile_id)
        .eq('status', 'success')
        .gte('redeemed_at', todayStart.toISOString());

      if ((count ?? 0) >= rules.max_redemptions_per_day) {
        await logFailure('rule_blocked', 'Daily redemption limit reached');
        return { success: false, status: 'rule_blocked', rejectionReason: 'Member has reached the daily redemption limit for this offer' };
      }
    }
  }

  // ── Atomic single-use gate ────────────────────────────────────────────────
  // All business rule checks have passed. Now atomically claim the token by
  // writing consumed_at only if it is still null. If another concurrent request
  // already consumed it between the lookup above and this write, 0 rows will be
  // returned and we must reject rather than record a double redemption.
  const { data: consumed, error: consumeError } = await supabase
    .from('redemption_tokens')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', token.id)
    .is('consumed_at', null)
    .select('id');

  if (consumeError) {
    // A genuine DB error — distinct from a concurrent-scan race. Do not record
    // a failed redemption against the member; the failure is server-side.
    console.error('[validate_redemption] token consume update failed:', consumeError.message);
    return { success: false, status: 'server_error', rejectionReason: 'A server error occurred. Please try again.' };
  }

  if (!consumed || consumed.length === 0) {
    // A concurrent request won the race. Log the failure but do not record a
    // success redemption for this attempt.
    await logFailure('rejected', 'Token already used (concurrent scan)');
    return { success: false, status: 'rejected', rejectionReason: 'This QR code has already been used' };
  }

  // ── Record success ────────────────────────────────────────────────────────
  await supabase.from('redemptions').insert({
    profile_id: token.profile_id,
    retailer_id: retailerId,
    retailer_location_id: token.retailer_location_id ?? null,
    offer_id: token.offer_id,
    redemption_token_id: token.id,
    status: 'success',
    validated_by_profile_id: userId,
    redeemed_at: new Date().toISOString(),
  });

  // Fetch member display name for the result screen.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', token.profile_id)
    .maybeSingle();

  const memberName = (profile?.full_name as string | null) ?? 'Member';

  return {
    success: true,
    status: 'success',
    offerTitle: offer.title,
    memberName,
  };
}
