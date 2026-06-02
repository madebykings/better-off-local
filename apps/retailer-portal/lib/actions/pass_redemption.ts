'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { ScanResult, RedemptionStatus } from './validate_redemption';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PassOffer = {
  offerId: string;
  title: string;
  valueText: string | null;
  venueScope: 'all' | 'specific';
  availabilityState: string;
  availableAt: string | null;
};

export type PassOffersResult =
  | { ok: true; consumerName: string | null; offers: PassOffer[] }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function hashToken(raw: string): Promise<string> {
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function getRetailerId(userId: string): Promise<string | null> {
  const service = createServiceClient();
  const { data } = await service
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

// ---------------------------------------------------------------------------
// getOffersForPass
// ---------------------------------------------------------------------------

/**
 * Loads available offers for the member identified by a membership pass QR.
 *
 * Called immediately after a successful membership pass scan, in the same
 * server action transition, so no extra spinner is needed.
 *
 * Steps:
 *   1. Hash rawToken → look up profile_id in membership_pass_tokens
 *   2. Re-verify pass has not expired (guard against race)
 *   3. Resolve the scanner's retailer_id
 *   4. Call get_retailer_offers_availability(retailer_id, consumer_id)
 *   5. Fetch offer display data (title, value_text, venue_scope)
 *   6. Return merged list + consumer first name
 */
export async function getOffersForPass(rawToken: string): Promise<PassOffersResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const service = createServiceClient();

  const retailerId = await getRetailerId(user.id);
  if (!retailerId) return { ok: false, error: 'No retailer account found.' };

  // Resolve the scanner's primary venue so the offer pass can be
  // attributed to the correct location.
  const { data: primaryVenue } = await service
    .from('retailer_locations')
    .select('id')
    .eq('retailer_id', retailerId)
    .eq('is_primary', true)
    .eq('is_active', true)
    .maybeSingle();
  // primaryVenue may be null for retailers with no active locations; the
  // RPC accepts null gracefully (no venue attribution rather than hard fail).

  const tokenHash = await hashToken(rawToken.trim());

  const { data: passToken } = await service
    .from('membership_pass_tokens')
    .select('profile_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!passToken) return { ok: false, error: 'Invalid or expired pass token.' };
  if (new Date(passToken.expires_at) < new Date()) {
    return { ok: false, error: 'Pass QR has expired. Ask the member to refresh.' };
  }

  const consumerId = passToken.profile_id as string;

  // Fetch consumer first name for the offer chooser UI.
  const { data: profile } = await service
    .from('profiles')
    .select('full_name')
    .eq('id', consumerId)
    .maybeSingle();
  const consumerName = (profile?.full_name as string | null)?.split(' ')[0] ?? null;

  // Availability check for all retailer offers × this consumer.
  const { data: availability, error: rpcError } = await service.rpc(
    'get_retailer_offers_availability',
    { p_retailer_id: retailerId, p_consumer_id: consumerId },
  );

  if (rpcError) {
    console.error('[getOffersForPass] RPC error:', rpcError.message);
    return { ok: false, error: 'Failed to load offers. Please try again.' };
  }

  const rows = (availability ?? []) as {
    offer_id: string;
    availability_state: string;
    available_at: string | null;
  }[];

  if (rows.length === 0) {
    return { ok: true, consumerName, offers: [] };
  }

  // Fetch offer display data.
  const offerIds = rows.map((r) => r.offer_id);
  const { data: offerDetails } = await service
    .from('offers')
    .select('id, title, value_text, venue_scope')
    .in('id', offerIds);

  const detailsById = new Map(
    (offerDetails ?? []).map((o) => [o.id, o]),
  );

  const offers: PassOffer[] = rows
    .map((row): PassOffer | null => {
      const detail = detailsById.get(row.offer_id);
      if (!detail) return null;
      return {
        offerId: row.offer_id,
        title: detail.title as string,
        valueText: (detail.value_text as string | null) ?? null,
        venueScope: ((detail.venue_scope as string) === 'specific' ? 'specific' : 'all'),
        availabilityState: row.availability_state,
        availableAt: row.available_at ?? null,
      };
    })
    .filter((o): o is PassOffer => o !== null);

  return { ok: true, consumerName, offers };
}

// ---------------------------------------------------------------------------
// redeemViaPass
// ---------------------------------------------------------------------------

/**
 * Records a redemption for the given offer using a membership pass token.
 *
 * Calls redeem_offer_via_pass RPC (service role) which mirrors the full
 * redeem_offer_token validation logic but does not consume the pass token.
 *
 * Returns the same ScanResult union as the offer-QR path so the existing
 * result card renders without modification.
 */
export async function redeemViaPass(
  rawToken: string,
  offerId: string,
  attemptId: string,
): Promise<ScanResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const service = createServiceClient();
  const tokenHash = await hashToken(rawToken.trim());

  const { data: rpcRows, error: rpcError } = await service.rpc('redeem_offer_via_pass', {
    p_pass_token_hash:       tokenHash,
    p_offer_id:              offerId,
    p_retailer_profile_id:   user.id,
    p_redemption_attempt_id: attemptId,
    p_retailer_location_id:  (primaryVenue?.id as string | undefined) ?? null,
  });

  if (rpcError) {
    console.error('[redeemViaPass] RPC error:', rpcError.message);
    return {
      token_type: 'redemption',
      valid: false,
      status: 'server_error',
      rejection_reason: 'Failed to process redemption. Please try again.',
      next_available_at: null,
    };
  }

  const result = (rpcRows as Record<string, unknown>[] | null)?.[0];

  if (!result) {
    return {
      token_type: 'redemption',
      valid: false,
      status: 'server_error',
      rejection_reason: 'Unexpected server response.',
      next_available_at: null,
    };
  }

  if (result.valid === true) {
    // Fetch consumer first name for the success card.
    let consumerName: string | null = null;
    const { data: passToken } = await service
      .from('membership_pass_tokens')
      .select('profile_id')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (passToken?.profile_id) {
      const { data: profile } = await service
        .from('profiles')
        .select('full_name')
        .eq('id', passToken.profile_id as string)
        .maybeSingle();
      consumerName = (profile?.full_name as string | null)?.split(' ')[0] ?? null;
    }

    return {
      token_type: 'redemption',
      valid: true,
      offer_title: (result.offer_title as string | null) ?? 'Offer',
      benefit_text: (result.benefit_text as string | null) ?? null,
      consumer_name: consumerName,
    };
  }

  return {
    token_type: 'redemption',
    valid: false,
    status: ((result.status as string) ?? 'rejected') as RedemptionStatus,
    rejection_reason:
      (result.rejection_reason as string | null) ?? 'Redemption could not be completed.',
    next_available_at: (result.next_available_at as string | null) ?? null,
  };
}
