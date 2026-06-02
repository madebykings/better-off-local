'use server';

import { revalidatePath } from 'next/cache';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';

export type VenueBillingResult = { error: string } | null;

/**
 * Purchases one additional venue slot by adding (or incrementing) a Stripe
 * subscription item on the retailer's existing annual subscription.
 *
 * Uses the Stripe REST API directly — same pattern as openBillingPortal.
 * Pro-ration is applied automatically by Stripe (create_prorations).
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY           — already used by openBillingPortal
 *   STRIPE_EXTRA_VENUE_PRICE_ID — Stripe Price ID for £10/venue/year
 *
 * On success: increments extra_venues_quantity in DB and revalidates /locations.
 * On failure: returns { error } so the client can surface it inline.
 */
export async function purchaseVenueSlot(locationId: string): Promise<VenueBillingResult> {
  const { retailerId } = await requireRetailerUser();
  const service = createServiceClient();

  // Verify the venue belongs to this retailer and is in paid_required state.
  const { data: venue } = await service
    .from('retailer_locations')
    .select('billing_status')
    .eq('id', locationId)
    .eq('retailer_id', retailerId)
    .eq('is_active', true)
    .maybeSingle();

  if (!venue) return { error: 'Venue not found.' };
  if (venue.billing_status !== 'paid_required') {
    return { error: 'This venue does not require a payment at this time.' };
  }

  const { data: sub } = await service
    .from('retailer_subscriptions')
    .select('stripe_subscription_id, extra_venue_stripe_item_id, extra_venues_quantity')
    .eq('retailer_id', retailerId)
    .eq('status', 'active')
    .maybeSingle();

  if (!sub?.stripe_subscription_id) {
    return { error: 'No active subscription found. Please activate your listing first.' };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const priceId   = process.env.STRIPE_EXTRA_VENUE_PRICE_ID;

  if (!stripeKey || !priceId) {
    console.error('[purchaseVenueSlot] missing STRIPE_SECRET_KEY or STRIPE_EXTRA_VENUE_PRICE_ID');
    return { error: 'Billing is not configured. Please contact support.' };
  }

  let stripeItemId: string;
  const currentQty = sub.extra_venues_quantity ?? 0;

  if (!sub.extra_venue_stripe_item_id) {
    // Create a new subscription item for the first extra venue.
    const res = await fetch('https://api.stripe.com/v1/subscription_items', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        subscription: sub.stripe_subscription_id,
        price: priceId,
        quantity: '1',
        proration_behavior: 'create_prorations',
      }).toString(),
    });

    const data = await res.json() as { id?: string; error?: { message?: string } };

    if (!res.ok || !data.id) {
      const msg = data.error?.message ?? 'Payment failed.';
      console.error('[purchaseVenueSlot] create item error:', msg);
      return { error: `Could not add venue: ${msg}` };
    }

    stripeItemId = data.id;
  } else {
    // Increment the existing subscription item.
    const res = await fetch(
      `https://api.stripe.com/v1/subscription_items/${sub.extra_venue_stripe_item_id}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          quantity: String(currentQty + 1),
          proration_behavior: 'create_prorations',
        }).toString(),
      },
    );

    const data = await res.json() as { id?: string; error?: { message?: string } };

    if (!res.ok) {
      const msg = data.error?.message ?? 'Payment failed.';
      console.error('[purchaseVenueSlot] update item error:', msg);
      return { error: `Could not add venue: ${msg}` };
    }

    stripeItemId = sub.extra_venue_stripe_item_id;
  }

  // Persist the new quantity, item ID, and venue billing status.
  const { error: dbError } = await service
    .from('retailer_subscriptions')
    .update({
      extra_venue_stripe_item_id: stripeItemId,
      extra_venues_quantity: currentQty + 1,
    })
    .eq('retailer_id', retailerId)
    .eq('status', 'active');

  if (dbError) {
    console.error('[purchaseVenueSlot] subscription DB error:', dbError.message);
  }

  // Mark the specific venue as paid.
  const { error: venueError } = await service
    .from('retailer_locations')
    .update({ billing_status: 'paid', grace_period_ends_at: null })
    .eq('id', locationId);

  if (venueError) {
    console.error('[purchaseVenueSlot] venue billing_status error:', venueError.message);
  }

  revalidatePath('/locations');
  revalidatePath('/locations/new');
  return null;
}
