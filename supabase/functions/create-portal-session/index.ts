import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Creates a Stripe Billing Portal session for the authenticated user.
 *
 * The caller is the consumer mobile app. On completion the Stripe portal
 * redirects to the app deep link so the user lands back in-app.
 *
 * Required env vars (auto-injected by Supabase runtime):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Required secrets (set via: supabase secrets set):
 *   STRIPE_SECRET_KEY
 *   APP_SCHEME                    — custom URI scheme (default: betterofflocal)
 *   APP_UNIVERSAL_LINK_DOMAIN     — optional HTTPS domain for universal links
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    console.log('[portal] FAIL reason=no-auth-header');
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('[portal] FAIL reason=missing-supabase-env');
    return json({ error: 'Server misconfigured' }, 500);
  }
  if (!stripeSecretKey) {
    console.error('[portal] FAIL reason=missing-stripe-key');
    return json({ error: 'Server misconfigured' }, 500);
  }

  // ── Authenticate ──────────────────────────────────────────────────────────

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    console.log('[portal] FAIL reason=getUser-rejected');
    return json({ error: 'Unauthorized' }, 401);
  }

  // ── Look up Stripe customer ID ────────────────────────────────────────────

  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: membership } = await admin
    .from('consumer_memberships')
    .select('stripe_customer_id')
    .eq('profile_id', user.id)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const customerId = membership?.stripe_customer_id as string | null;
  console.log('[portal] user lookup', { userId: user.id, customerIdPresent: Boolean(customerId) });

  if (!customerId) {
    return json({ error: 'No billing account found for this user' }, 404);
  }

  // ── Build return URL ──────────────────────────────────────────────────────

  const appDomain = Deno.env.get('APP_UNIVERSAL_LINK_DOMAIN');
  const appScheme = Deno.env.get('APP_SCHEME') ?? 'betterofflocal';
  const returnUrl = appDomain
    ? `https://${appDomain}/account`
    : `${appScheme}://account`;

  // ── Create portal session ─────────────────────────────────────────────────

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer: customerId,
      return_url: returnUrl,
    }).toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
    console.error('[portal] stripe error:', msg);
    return json({ error: `Stripe error: ${msg}` }, 500);
  }

  const portalUrl = (data as { url?: string }).url;
  if (!portalUrl) {
    console.error('[portal] no URL in Stripe response');
    return json({ error: 'No portal URL returned' }, 500);
  }

  console.log('[portal] session created for user', user.id);
  return json({ url: portalUrl });
});
