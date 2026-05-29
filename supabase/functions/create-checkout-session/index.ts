import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Creates a Stripe Checkout Session for a consumer membership purchase.
 *
 * The mobile app calls this edge function with the authenticated user's JWT.
 * It creates or retrieves the Stripe customer, then returns a Checkout Session URL.
 * The mobile app opens the URL in the device browser. Stripe redirects back to
 * the app deep link on success or cancel.
 *
 * Uses direct Stripe REST API calls (no SDK) for Deno Edge Runtime compatibility.
 *
 * Required env vars (auto-injected by Supabase runtime — do not set manually):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Required secrets (set via: supabase secrets set):
 *   STRIPE_SECRET_KEY
 *   STRIPE_PRICE_ID_MONTHLY
 *   STRIPE_PRICE_ID_ANNUAL
 *   APP_SCHEME                    — custom URI scheme (default: betterofflocal)
 *   APP_UNIVERSAL_LINK_DOMAIN     — optional; use HTTPS universal links when set
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function safeHost(url: string | undefined | null): string | null {
  if (!url) return null;
  try { return new URL(url).host; } catch { return 'INVALID'; }
}

// ---------------------------------------------------------------------------
// Stripe REST helpers
// ---------------------------------------------------------------------------

type FormValue = string | number | boolean | null | undefined;
type FormData = { [key: string]: FormValue | FormData | (FormValue | FormData)[] };

function toFormEncoded(params: FormData, prefix = ''): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item !== null && item !== undefined && typeof item === 'object') {
          parts.push(toFormEncoded(item as FormData, `${fullKey}[${i}]`));
        } else {
          parts.push(
            `${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(String(item))}`,
          );
        }
      }
    } else if (typeof value === 'object') {
      parts.push(toFormEncoded(value as FormData, fullKey));
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.join('&');
}

async function stripePost<T>(path: string, params: FormData): Promise<T> {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY')!;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: toFormEncoded(params),
  });
  const data = await res.json();
  console.log(`[checkout] stripe POST /${path} status=${res.status}`);
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } }).error?.message;
    console.error(`[checkout] stripe /${path} error: ${msg ?? `HTTP ${res.status}`}`);
    throw new Error(msg ?? `Stripe error: ${res.status}`);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── Read inputs ────────────────────────────────────────────────────────────

  const authHeader = req.headers.get('authorization');
  const authHeaderPresent = authHeader !== null;
  const bearerPrefix = authHeaderPresent && authHeader.startsWith('Bearer ');
  const jwtLength = bearerPrefix ? authHeader.slice(7).length : 0;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  console.log('[checkout] request', {
    method: req.method,
    authHeaderPresent,
    bearerPrefix,
    jwtLength,
    supabaseHost: safeHost(supabaseUrl),
    anonKeyPresent: Boolean(supabaseAnonKey),
  });

  // ── Auth header guard ──────────────────────────────────────────────────────

  if (!authHeader) {
    console.log('[checkout] FAIL reason=no-auth-header');
    return json({ error: 'Unauthorized' }, 401);
  }

  // ── Supabase env guards ────────────────────────────────────────────────────
  // SUPABASE_URL and SUPABASE_ANON_KEY are auto-injected by the Edge Runtime.
  // If getUser() returns HTML instead of JSON, the URL is wrong — fail early
  // with a clear log rather than surfacing a parse error to the caller.

  if (!supabaseUrl || !supabaseUrl.includes('.supabase.co')) {
    console.error('[checkout] invalid SUPABASE_URL', {
      present: Boolean(supabaseUrl),
      host: safeHost(supabaseUrl),
    });
    return json({ error: 'Server misconfigured' }, 500);
  }

  if (!supabaseAnonKey) {
    console.error('[checkout] FAIL reason=missing-anon-key');
    return json({ error: 'Server misconfigured' }, 500);
  }

  // ── Authenticate via JWT ───────────────────────────────────────────────────

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('[checkout] getUser', {
    userIdPresent: Boolean(user?.id),
    error: userError?.message ?? null,
  });

  if (userError || !user) {
    console.log('[checkout] FAIL reason=getUser-rejected status=401');
    return json({ error: 'Unauthorized' }, 401);
  }

  // ── Parse and validate plan ────────────────────────────────────────────────

  let plan: string;
  try {
    const body = await req.json();
    plan = body.plan;
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  if (!['monthly', 'annual'].includes(plan)) {
    return json({ error: 'Invalid plan. Must be monthly or annual.' }, 400);
  }

  const priceId =
    plan === 'monthly'
      ? Deno.env.get('STRIPE_PRICE_ID_MONTHLY')
      : Deno.env.get('STRIPE_PRICE_ID_ANNUAL');

  console.log('[checkout] plan', {
    plan,
    priceIdPresent: Boolean(priceId),
    priceIdSuffix: priceId ? priceId.slice(-6) : null,
  });

  if (!priceId) {
    console.error(`[checkout] FAIL reason=missing-price-id plan=${plan}`);
    return json({ error: 'Plan not configured' }, 500);
  }

  // ── Create Stripe checkout session ────────────────────────────────────────

  try {
    // Use service role to read existing membership (bypasses RLS for lookup).
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey!);

    const { data: membership } = await supabaseAdmin
      .from('consumer_memberships')
      .select('stripe_customer_id')
      .eq('profile_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .maybeSingle();

    let customerId = membership?.stripe_customer_id as string | undefined;

    if (!customerId) {
      const customer = await stripePost<{ id: string }>('customers', {
        email: user.email ?? '',
        'metadata[supabase_user_id]': user.id,
      });
      customerId = customer.id;
    }

    const appDomain = Deno.env.get('APP_UNIVERSAL_LINK_DOMAIN');
    const appScheme = Deno.env.get('APP_SCHEME') ?? 'betterofflocal';

    const successUrl = appDomain
      ? `https://${appDomain}/subscription-success`
      : `${appScheme}://subscription-success`;
    const cancelUrl = appDomain
      ? `https://${appDomain}/paywall`
      : `${appScheme}://paywall`;

    const session = await stripePost<{ url: string }>('checkout/sessions', {
      customer: customerId,
      'payment_method_types[0]': 'card',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': 1,
      mode: 'subscription',
      'subscription_data[metadata][supabase_user_id]': user.id,
      'subscription_data[metadata][plan]': plan,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    console.log(`[checkout] session created user=${user.id} plan=${plan}`);

    return json({ url: session.url });
  } catch (err) {
    console.error('[checkout] error', err);
    return json({ error: 'Failed to create checkout session' }, 500);
  }
});
