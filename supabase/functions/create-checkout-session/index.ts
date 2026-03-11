import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Creates a Stripe Checkout Session for a consumer membership purchase.
 *
 * The mobile app calls this edge function with the authenticated user's JWT.
 * It creates or retrieves the Stripe customer, then returns a Checkout Session URL.
 * The mobile app opens the URL in the device browser. Stripe redirects back to
 * the app deep link on success or cancel.
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_PRICE_ID_MONTHLY        — Stripe price ID for the monthly plan
 *   STRIPE_PRICE_ID_ANNUAL         — Stripe price ID for the annual plan
 *   APP_SCHEME                     — Deep link scheme (e.g. 'betterofflocal')
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
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Authenticate the calling user via their JWT.
  const supabaseUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { authorization: authHeader } } },
  );

  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let plan: string;
  try {
    const body = await req.json();
    plan = body.plan;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!['monthly', 'annual'].includes(plan)) {
    return new Response(JSON.stringify({ error: 'Invalid plan. Must be monthly or annual.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const priceId = plan === 'monthly'
    ? Deno.env.get('STRIPE_PRICE_ID_MONTHLY')!
    : Deno.env.get('STRIPE_PRICE_ID_ANNUAL')!;

  if (!priceId) {
    console.error(`Missing env var for plan: ${plan}`);
    return new Response(JSON.stringify({ error: 'Plan not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Use service role to read existing membership (bypasses RLS for lookup).
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: membership } = await supabaseAdmin
      .from('consumer_memberships')
      .select('stripe_customer_id')
      .eq('profile_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .maybeSingle();

    let customerId = membership?.stripe_customer_id as string | undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    const appScheme = Deno.env.get('APP_SCHEME') ?? 'betterofflocal';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan },
      },
      success_url: `${appScheme}://subscription-success`,
      cancel_url: `${appScheme}://paywall`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Stripe error:', err);
    return new Response(JSON.stringify({ error: 'Failed to create checkout session' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
