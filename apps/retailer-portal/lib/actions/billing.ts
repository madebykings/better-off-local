'use server';

import { redirect } from 'next/navigation';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createClient } from '@/lib/supabase/server';

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
  await requireRetailerUser();

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
