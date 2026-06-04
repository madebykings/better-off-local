'use server';

import { redirect } from 'next/navigation';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type CheckoutState = { error: string | null };

// ── Friendly error copy ───────────────────────────────────────────────────────

function friendlyError(apiMessage: string | null, status: number | undefined): string {
  if (status === 403 || apiMessage?.includes('approved')) {
    return 'Your listing must be approved before activation.';
  }
  if (status === 409 || apiMessage?.includes('already active')) {
    return 'Your listing already has an active subscription.';
  }
  if (apiMessage?.includes('not configured') || apiMessage?.includes('Billing')) {
    return 'Billing is not configured yet. Please contact support.';
  }
  return "We couldn't start checkout. Please try again.";
}

// ── Server action ─────────────────────────────────────────────────────────────

/**
 * Initiates Stripe Checkout for the retailer annual subscription.
 *
 * Designed for use with `useActionState` — returns `{ error }` on failure
 * so the client can show an inline message instead of crashing into an error
 * boundary. On success, redirects to the Stripe Checkout URL (never returns).
 */
export async function startCheckout(
  _prevState: CheckoutState,
  _formData: FormData,
): Promise<CheckoutState> {
  // requireRetailerUser redirects to /sign-in if not authenticated.
  // Let that redirect propagate — this action is only reached from authenticated pages.
  const { accessRole } = await requireRetailerUser();
  if (accessRole !== 'owner') {
    return { error: 'Only the account owner can manage billing.' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.functions.invoke(
    'create-retailer-checkout-session',
    { method: 'POST' },
  );

  if (error) {
    // Attempt to parse the error body from the edge function response.
    let apiMessage: string | null = null;
    let status: number | undefined;
    try {
      // FunctionsHttpError exposes the raw Response on `.context`
      const ctx = (error as { context?: Response }).context;
      status = ctx?.status;
      const body = await ctx?.json() as { error?: string } | undefined;
      apiMessage = body?.error ?? null;
    } catch { /* ignore parse failures */ }

    console.error('[startCheckout] edge function error', { status, apiMessage, error });
    return { error: friendlyError(apiMessage, status) };
  }

  if (!data?.url) {
    console.error('[startCheckout] no URL in response', data);
    return { error: "We couldn't start checkout. Please try again." };
  }

  // Success — redirect to Stripe. This throws NEXT_REDIRECT internally
  // and is never caught by the try/catch above.
  redirect(data.url as string);
}

// ── Stripe Customer Portal ────────────────────────────────────────────────────

/**
 * Creates a Stripe Billing Portal session for the authenticated retailer and
 * redirects to it. The portal lets them update payment details, view invoices,
 * and cancel their subscription. Stripe returns them to /billing afterward.
 */
export async function openBillingPortal(): Promise<void> {
  const { retailerId, accessRole } = await requireRetailerUser();
  if (accessRole !== 'owner') {
    redirect('/billing?error=access_denied');
  }
  const service = createServiceClient();

  const { data: sub } = await service
    .from('retailer_subscriptions')
    .select('stripe_customer_id')
    .eq('retailer_id', retailerId)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const customerId = sub?.stripe_customer_id as string | null;
  if (!customerId) {
    // Redirect back with a query param so the page can surface the error.
    redirect('/billing?error=no_customer');
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('[openBillingPortal] STRIPE_SECRET_KEY not set');
    redirect('/billing?error=misconfigured');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://portal.betterofflocal.co.uk';
  const returnUrl = `${appUrl}/billing`;

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ customer: customerId, return_url: returnUrl }).toString(),
  });

  const json = await res.json() as { url?: string; error?: { message?: string } };
  if (!res.ok || !json.url) {
    console.error('[openBillingPortal] Stripe error:', json.error?.message);
    redirect('/billing?error=stripe_error');
  }

  redirect(json.url);
}
