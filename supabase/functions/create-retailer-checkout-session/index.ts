import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Creates (or reuses) a Stripe Checkout Session for a retailer annual subscription.
 *
 * The retailer portal calls this edge function with the authenticated user's JWT.
 * Idempotent: reuses an existing inactive session created within the last 30 minutes.
 *
 * Guards:
 *   - Retailer must be approved (approval_status = 'approved')
 *   - If already active, returns 409
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_RETAILER_ANNUAL_PRICE_ID  — Stripe Price ID for the annual retailer plan
 *   RETAILER_PORTAL_URL              — e.g. 'https://portal.betterofflocal.co.uk'
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 */

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { authorization: authHeader } } },
  );

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) return json({ error: 'Unauthorized' }, 401);

  // ── Service-role client for DB writes ────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── Resolve retailer for this user ──────────────────────────────────────────
  const { data: retailerUser } = await supabase
    .from('retailer_users')
    .select('retailer_id')
    .eq('profile_id', user.id)
    .eq('is_active', true)
    .single();

  if (!retailerUser) return json({ error: 'Retailer not found' }, 404);
  const retailerId = retailerUser.retailer_id;

  // ── Fetch retailer state ─────────────────────────────────────────────────────
  const { data: retailer } = await supabase
    .from('retailers')
    .select('id, name, email, approval_status, stripe_customer_id')
    .eq('id', retailerId)
    .single();

  if (!retailer) return json({ error: 'Retailer not found' }, 404);

  if (retailer.approval_status !== 'approved') {
    return json({ error: 'Retailer must be approved before activating' }, 403);
  }

  // ── Check if already active ───────────────────────────────────────────────────
  const { data: existingSub } = await supabase
    .from('retailer_subscriptions')
    .select('id, status, stripe_checkout_session_id, updated_at')
    .eq('retailer_id', retailerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingSub?.status === 'active') {
    return json({ error: 'Subscription already active' }, 409);
  }

  // ── Idempotency: reuse recent inactive session (< 30 min) ────────────────────
  if (
    existingSub?.status === 'inactive' &&
    existingSub.stripe_checkout_session_id
  ) {
    const sessionCreatedAt = new Date(existingSub.updated_at).getTime();
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

    if (sessionCreatedAt > thirtyMinutesAgo) {
      try {
        const session = await stripe.checkout.sessions.retrieve(
          existingSub.stripe_checkout_session_id,
        );
        if (session.status === 'open' && session.url) {
          return json({ url: session.url });
        }
      } catch {
        // Session expired or not found in Stripe — fall through to create new
      }
    }
  }

  // ── Resolve or create Stripe customer ─────────────────────────────────────────
  let customerId = retailer.stripe_customer_id as string | undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: retailer.email ?? user.email,
      name: retailer.name ?? undefined,
      metadata: { retailer_id: retailerId },
    });
    customerId = customer.id;

    await supabase
      .from('retailers')
      .update({ stripe_customer_id: customerId })
      .eq('id', retailerId);
  }

  // ── Stripe price ──────────────────────────────────────────────────────────────
  const priceId = Deno.env.get('STRIPE_RETAILER_ANNUAL_PRICE_ID');
  if (!priceId) {
    console.error('Missing STRIPE_RETAILER_ANNUAL_PRICE_ID');
    return json({ error: 'Billing not configured' }, 500);
  }

  // ── Redirect URLs ─────────────────────────────────────────────────────────────
  const portalUrl = Deno.env.get('RETAILER_PORTAL_URL') ?? 'http://localhost:3001';
  const successUrl = `${portalUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl  = `${portalUrl}/dashboard`;

  // ── Create Checkout Session ───────────────────────────────────────────────────
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    subscription_data: {
      metadata: {
        retailer_id: retailerId,
        type: 'retailer_subscription',
      },
    },
    metadata: {
      retailer_id: retailerId,
      type: 'retailer_subscription',
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  // ── Upsert subscription row ───────────────────────────────────────────────────
  if (existingSub) {
    await supabase
      .from('retailer_subscriptions')
      .update({
        stripe_price_id: priceId,
        stripe_checkout_session_id: session.id,
        status: 'inactive',
      })
      .eq('id', existingSub.id);
  } else {
    await supabase.from('retailer_subscriptions').insert({
      retailer_id: retailerId,
      stripe_price_id: priceId,
      stripe_checkout_session_id: session.id,
      billing_interval: 'annual',
      status: 'inactive',
    });
  }

  return json({ url: session.url });
});
