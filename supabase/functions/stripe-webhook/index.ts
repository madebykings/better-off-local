import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Stripe webhook handler — no Stripe SDK, Web Crypto signature verification.
 *
 * Every 500 response has a unique body string so the failure point is
 * identifiable from the Stripe delivery log without needing function logs.
 *
 * Required Stripe webhook events:
 *   checkout.session.completed
 *   invoice.paid
 *   invoice.payment_failed
 *   customer.subscription.deleted
 *
 * Required secrets:
 *   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   RETAILER_GRACE_DAYS (default: 0)
 */

// ---------------------------------------------------------------------------
// Minimal Stripe REST types
// ---------------------------------------------------------------------------

interface StripeSubscriptionItem {
  price?: { recurring?: { interval?: string } };
  // Stripe API ≥ 2025 may move period timestamps to the item level.
  current_period_start?: number;
  current_period_end?: number;
}

interface StripeSubscription {
  id: string;
  status: string;
  metadata: Record<string, string>;
  customer: string;
  items: { data: StripeSubscriptionItem[] };
  // Root-level period timestamps — present in older API versions.
  // Newer versions may omit these; always use periodStart/periodEnd helpers.
  current_period_start?: number;
  current_period_end?: number;
  start_date?: number;
  cancel_at_period_end: boolean;
}

interface StripeCheckoutSession {
  id: string;
  mode: string;
  subscription: string | null;
  customer: string | null;
  metadata: Record<string, string>;
}

interface StripeInvoice {
  subscription: string | null;
  customer: string | null;
  billing_reason: string | null;
  amount_paid: number;
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

// ---------------------------------------------------------------------------
// Stripe REST helper
// ---------------------------------------------------------------------------

async function stripeGet<T>(path: string): Promise<T> {
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY not set');

  console.log(`[webhook] stripe GET /${path}`);
  let res: Response;
  try {
    res = await fetch(`https://api.stripe.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    console.error(`[webhook] stripe GET /${path} network error:`, msg);
    throw new Error(`Stripe network error: ${msg}`);
  }

  const data = await res.json();
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
    console.error(`[webhook] stripe GET /${path} API error: status=${res.status} msg=${msg}`);
    throw new Error(`Stripe API error: ${msg}`);
  }

  console.log(`[webhook] stripe GET /${path} ok`);
  return data as T;
}

// ---------------------------------------------------------------------------
// Webhook signature verification — Web Crypto HMAC-SHA256, no SDK
// ---------------------------------------------------------------------------

async function verifyAndParseEvent(
  body: string,
  sigHeader: string,
  secret: string,
): Promise<StripeEvent> {
  const parts: Record<string, string[]> = {};
  for (const part of sigHeader.split(',')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq);
    const v = part.slice(eq + 1);
    (parts[k] ??= []).push(v);
  }

  const timestamp = parts['t']?.[0];
  const sigs = parts['v1'] ?? [];
  if (!timestamp || sigs.length === 0) throw new Error('Malformed stripe-signature header');

  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    throw new Error(`Webhook timestamp outside 300s tolerance (ts=${timestamp})`);
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBytes = await crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    encoder.encode(`${timestamp}.${body}`),
  );
  const expected = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (!sigs.some((s) => s === expected)) throw new Error('Signature mismatch');

  return JSON.parse(body) as StripeEvent;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type MembershipStatus = 'inactive' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';

function mapStripeStatus(s: string): MembershipStatus {
  switch (s) {
    case 'active':             return 'active';
    case 'trialing':           return 'trialing';
    case 'past_due':           return 'past_due';
    case 'canceled':           return 'cancelled';
    case 'incomplete_expired': return 'expired';
    default:                   return 'inactive';
  }
}

function planInterval(sub: StripeSubscription): 'monthly' | 'annual' {
  return sub.items.data[0]?.price?.recurring?.interval === 'year' ? 'annual' : 'monthly';
}

/**
 * Convert a Stripe Unix timestamp (seconds) to an ISO string.
 * Returns null for any value that would produce an invalid Date.
 */
function stripeTimestampToIso(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const d = new Date(value * 1000);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Resolve current_period_start/end from the subscription root, falling back
 * to the first subscription item if the root fields are absent (Stripe API ≥ 2025).
 * Logs the raw values so failures are visible in function logs.
 */
function resolvePeriodDates(
  sub: StripeSubscription,
  context: string,
): { periodStart: string | null; periodEnd: string | null } {
  const item = sub.items.data[0];

  const rawStart = sub.current_period_start ?? item?.current_period_start;
  const rawEnd   = sub.current_period_end   ?? item?.current_period_end;

  console.log(`[webhook] ${context} period date resolution`, {
    rootPeriodStart:   sub.current_period_start   ?? null,
    rootPeriodEnd:     sub.current_period_end     ?? null,
    itemPeriodStart:   item?.current_period_start ?? null,
    itemPeriodEnd:     item?.current_period_end   ?? null,
    resolvedStart:     rawStart ?? null,
    resolvedEnd:       rawEnd   ?? null,
    startDate:         sub.start_date             ?? null,
    status:            sub.status,
  });

  return {
    periodStart: stripeTimestampToIso(rawStart),
    periodEnd:   stripeTimestampToIso(rawEnd),
  };
}

/**
 * Build the consumer_memberships upsert payload.
 * Throws with a descriptive message if required date fields are unresolvable.
 */
function buildMembershipPayload(
  sub: StripeSubscription,
  customerId: string,
  context: string,
): Record<string, unknown> {
  const { periodStart, periodEnd } = resolvePeriodDates(sub, context);

  if (!periodEnd) {
    throw new Error(
      `Missing subscription period dates: current_period_end unresolvable for subscription ${sub.id}`,
    );
  }

  return {
    profile_id:              sub.metadata.supabase_user_id,
    stripe_customer_id:      customerId,
    stripe_subscription_id:  sub.id,
    plan_interval:           planInterval(sub),
    status:                  mapStripeStatus(sub.status),
    current_period_start:    periodStart,
    current_period_end:      periodEnd,
    cancel_at_period_end:    sub.cancel_at_period_end,
    started_at:              stripeTimestampToIso(sub.start_date) ?? periodStart,
    ended_at:                null,
  };
}

function logSupabaseError(
  label: string,
  err: { message: string; code?: string; details?: string; hint?: string },
  context: Record<string, unknown>,
) {
  console.error(`[webhook] ${label}:`, {
    message: err.message,
    code: err.code ?? null,
    details: err.details ?? null,
    hint: err.hint ?? null,
    ...context,
  });
}

// ---------------------------------------------------------------------------
// Referral reward helper
// ---------------------------------------------------------------------------

/**
 * Triggered on the first paid invoice for a new consumer subscription.
 *
 * Flow:
 * 1. Look up invitee's referral_invitations row.
 * 2. Resolve referrer → profile → stripe_customer_id.
 * 3. Fraud checks: referrer membership active, rate limit (5/30 days).
 * 4. Insert referral_rewards (pending — confirmed after grace period).
 * 5. Apply Stripe customer balance credit to referrer.
 *
 * Idempotent: keyed on referral_invitation_id uniqueness.
 * Non-critical: errors are logged but do not fail the webhook response.
 *
 * Reward: monthly plan price (or annual ÷ 12 for annual subscribers).
 * Rate limit: 5 confirmed rewards per referrer per 30-day window.
 */
async function handleReferralReward(
  supabase: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>,
  inviteeUserId: string,
  stripeCustomerId: string,
  amountPaidCents: number,
): Promise<void> {
  try {
    // 1. Find invitation for this invitee
    const { data: invitation } = await supabase
      .from('referral_invitations')
      .select('id, referral_code_id, referral_codes(profile_id)')
      .eq('invitee_profile_id', inviteeUserId)
      .maybeSingle();

    if (!invitation) {
      console.log('[referral] no invitation found for invitee', { inviteeUserId });
      return;
    }

    // Reward already exists for this invitation
    const { data: existing } = await supabase
      .from('referral_rewards')
      .select('id')
      .eq('referral_invitation_id', invitation.id)
      .maybeSingle();

    if (existing) {
      console.log('[referral] reward already exists for invitation', { invitationId: invitation.id });
      return;
    }

    const referrerProfileId = (invitation.referral_codes as { profile_id: string } | null)?.profile_id;
    if (!referrerProfileId) {
      console.warn('[referral] could not resolve referrer profile', { invitationId: invitation.id });
      return;
    }

    // 2. Referrer membership must be active
    const { data: membership } = await supabase
      .from('consumer_memberships')
      .select('stripe_customer_id')
      .eq('profile_id', referrerProfileId)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (!membership?.stripe_customer_id) {
      console.log('[referral] referrer has no active membership — skipping reward', { referrerProfileId });
      return;
    }

    // 3. Rate limit: max 5 confirmed rewards in 30 days
    const windowStart = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { count: recentCount } = await supabase
      .from('referral_rewards')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_profile_id', referrerProfileId)
      .in('status', ['confirmed', 'applied', 'pending'])
      .gte('created_at', windowStart);

    const RATE_LIMIT = 5;
    const isRateLimited = (recentCount ?? 0) >= RATE_LIMIT;
    const rewardStatus = isRateLimited ? 'review' : 'pending';

    // Reward amount: monthly equivalent (annual ÷ 12, or actual amount)
    const rewardAmountPence = Math.round(amountPaidCents / (amountPaidCents > 2000 ? 12 : 1));
    const cappedReward = Math.min(rewardAmountPence, 600); // cap at 600p (£6) = approx 1 month

    // 4. Insert reward row
    const { data: reward, error: insertErr } = await supabase
      .from('referral_rewards')
      .insert({
        referral_invitation_id: invitation.id,
        referrer_profile_id: referrerProfileId,
        reward_amount_pence: cappedReward,
        status: rewardStatus,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('[referral] failed to insert reward', { error: insertErr.message });
      return;
    }

    if (isRateLimited) {
      console.log('[referral] reward queued for review (rate limit)', { referrerProfileId, rewardId: reward.id });
      return;
    }

    // 5. Apply Stripe customer balance credit
    const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!secretKey) {
      console.error('[referral] STRIPE_SECRET_KEY not set — cannot apply credit');
      return;
    }

    const creditAmount = -cappedReward; // negative = credit to customer
    const body = new URLSearchParams({
      amount: String(creditAmount),
      currency: 'gbp',
      description: `Referral reward — friend joined Better Off Local`,
    });

    const stripeRes = await fetch(
      `https://api.stripe.com/v1/customers/${membership.stripe_customer_id}/balance_transactions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      },
    );

    if (!stripeRes.ok) {
      const errData = await stripeRes.json();
      console.error('[referral] Stripe credit failed', { error: errData, referrerProfileId });
      return;
    }

    const txn = await stripeRes.json();

    // Update reward row with Stripe txn ID and mark applied
    await supabase
      .from('referral_rewards')
      .update({
        stripe_balance_txn_id: txn.id,
        status: 'applied',
        applied_at: new Date().toISOString(),
      })
      .eq('id', reward.id);

    console.log('[referral] reward applied', {
      referrerProfileId,
      rewardId: reward.id,
      stripeTxnId: txn.id,
      amountPence: cappedReward,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[referral] unexpected error in handleReferralReward', { error: msg });
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  // ── Env sanity check ────────────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  console.log('[webhook] init', {
    supabaseUrlPresent: Boolean(supabaseUrl),
    supabaseKeyPresent: Boolean(supabaseKey),
    webhookSecretPresent: Boolean(webhookSecret),
    stripeKeyPresent: Boolean(Deno.env.get('STRIPE_SECRET_KEY')),
  });

  if (!supabaseUrl || !supabaseKey) {
    console.error('[webhook] FATAL: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return new Response('Server misconfigured: missing Supabase env', { status: 500 });
  }
  if (!webhookSecret) {
    console.error('[webhook] FATAL: missing STRIPE_WEBHOOK_SECRET');
    return new Response('Server misconfigured: missing webhook secret', { status: 500 });
  }

  // ── Signature verification ──────────────────────────────────────────────────
  const sigHeader = req.headers.get('stripe-signature') ?? '';
  const body = await req.text();

  console.log('[webhook] signature header present:', sigHeader.length > 0, 'body bytes:', body.length);

  let event: StripeEvent;
  try {
    event = await verifyAndParseEvent(body, sigHeader, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[webhook] signature verification failed:', msg);
    return new Response(`Signature error: ${msg}`, { status: 400 });
  }

  console.log(`[webhook] event=${event.type} id=${event.id}`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    switch (event.type) {

      // ── checkout.session.completed ──────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as StripeCheckoutSession;
        console.log('[webhook] checkout.session.completed', {
          sessionId: session.id,
          mode: session.mode,
          metadataType: session.metadata?.type ?? null,
          subscriptionPresent: Boolean(session.subscription),
          customerPresent: Boolean(session.customer),
        });

        // ── Retailer ──────────────────────────────────────────────────────────
        if (session.metadata?.type === 'retailer_subscription') {
          const retailerId = session.metadata?.retailer_id;
          const subscriptionId = session.subscription;
          if (!retailerId || !subscriptionId) {
            console.warn('[webhook] checkout.session.completed retailer: missing retailer_id or subscription', { sessionId: session.id, retailerId, subscriptionId });
            break;
          }
          const { error } = await supabase
            .from('retailer_subscriptions')
            .update({ stripe_subscription_id: subscriptionId })
            .eq('retailer_id', retailerId)
            .eq('stripe_checkout_session_id', session.id);
          if (error) {
            logSupabaseError('checkout.session.completed retailer: link failed', error, { retailerId, subscriptionId });
            return new Response('DB error: retailer subscription link', { status: 500 });
          }
          console.log('[webhook] checkout.session.completed retailer: subscription linked', { retailerId, subscriptionId });
          break;
        }

        // ── Consumer ──────────────────────────────────────────────────────────
        if (session.mode !== 'subscription') {
          console.log('[webhook] checkout.session.completed: non-subscription mode, skipping', { mode: session.mode });
          break;
        }

        const subscriptionId = session.subscription;
        if (!subscriptionId) {
          console.error('[webhook] checkout.session.completed consumer: session.subscription is null', { sessionId: session.id });
          return new Response('Missing subscription: checkout session has no subscription id', { status: 500 });
        }

        // supabase_user_id is in subscription_data.metadata, not session.metadata.
        let sub: StripeSubscription;
        try {
          sub = await stripeGet<StripeSubscription>(`subscriptions/${subscriptionId}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[webhook] checkout.session.completed consumer: subscription retrieve failed', { subscriptionId, error: msg });
          return new Response(`Stripe retrieve error: subscription ${subscriptionId}`, { status: 500 });
        }

        const userId = sub.metadata?.supabase_user_id ?? null;
        const plan = planInterval(sub);
        const status = mapStripeStatus(sub.status);

        console.log('[webhook] checkout.session.completed consumer: subscription retrieved', {
          subscriptionId: sub.id,
          subStatus: sub.status,
          mappedStatus: status,
          plan,
          userIdPresent: Boolean(userId),
          rawPeriodEnd: sub.current_period_end ?? null,
          currentPeriodEnd: stripeTimestampToIso(sub.current_period_end),
          customerPresent: Boolean(sub.customer),
          metadataKeys: Object.keys(sub.metadata ?? {}),
        });

        if (!userId) {
          console.error('[webhook] checkout.session.completed consumer: supabase_user_id missing from subscription metadata', {
            subscriptionId: sub.id,
            metadataKeys: Object.keys(sub.metadata ?? {}),
          });
          return new Response('Missing user metadata: supabase_user_id not in subscription metadata', { status: 500 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = buildMembershipPayload(sub, session.customer ?? sub.customer, 'checkout.session.completed');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[webhook] checkout.session.completed consumer: date build failed', { error: msg, subscriptionId: sub.id });
          return new Response(`Missing subscription period dates: ${msg}`, { status: 500 });
        }

        console.log('[webhook] checkout.session.completed consumer: upserting membership', {
          subscriptionId: sub.id,
          planInterval: payload.plan_interval,
          status: payload.status,
          currentPeriodEnd: payload.current_period_end,
          userIdPresent: Boolean(payload.profile_id),
        });

        const { error: upsertErr } = await supabase
          .from('consumer_memberships')
          .upsert(payload, { onConflict: 'stripe_subscription_id' });

        if (upsertErr) {
          logSupabaseError('checkout.session.completed consumer: upsert failed', upsertErr, {
            subscriptionId: sub.id,
            userIdPresent: Boolean(userId),
          });
          return new Response('DB error: consumer membership upsert', { status: 500 });
        }

        console.log('[webhook] checkout.session.completed consumer: membership upserted OK', {
          subscriptionId: sub.id,
          plan,
          status,
          userIdPresent: Boolean(userId),
        });
        break;
      }

      // ── invoice.paid ────────────────────────────────────────────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as StripeInvoice;
        const subscriptionId = invoice.subscription;
        console.log('[webhook] invoice.paid', { subscriptionId, customerPresent: Boolean(invoice.customer) });

        if (!subscriptionId) {
          console.warn('[webhook] invoice.paid: no subscription id — skipping');
          break;
        }

        let sub: StripeSubscription;
        try {
          sub = await stripeGet<StripeSubscription>(`subscriptions/${subscriptionId}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[webhook] invoice.paid: subscription retrieve failed', { subscriptionId, error: msg });
          return new Response(`Stripe retrieve error: subscription ${subscriptionId}`, { status: 500 });
        }

        // ── Retailer ──────────────────────────────────────────────────────────
        if (sub.metadata?.type === 'retailer_subscription') {
          const retailerId = sub.metadata?.retailer_id;
          if (!retailerId) {
            console.warn('[webhook] invoice.paid retailer: no retailer_id in metadata', { subscriptionId });
            break;
          }
          const { periodStart: rPeriodStart, periodEnd: rPeriodEnd } = resolvePeriodDates(sub, 'invoice.paid retailer');
          const { error: subErr } = await supabase
            .from('retailer_subscriptions')
            .update({
              stripe_subscription_id: sub.id,
              status: 'active',
              current_period_start: rPeriodStart,
              current_period_end: rPeriodEnd,
              cancel_at_period_end: sub.cancel_at_period_end,
              started_at: stripeTimestampToIso(sub.start_date) ?? rPeriodStart,
              ended_at: null,
            })
            .eq('retailer_id', retailerId)
            .eq('stripe_subscription_id', sub.id);
          if (subErr) {
            logSupabaseError('invoice.paid retailer: subscription update failed', subErr, { retailerId, subscriptionId: sub.id });
            return new Response('DB error: retailer subscription update', { status: 500 });
          }
          // Non-critical: visibility, primary venue billing status, and audit.
          const { data: retailer } = await supabase.from('retailers').select('approval_status').eq('id', retailerId).single();
          if (retailer?.approval_status === 'approved') {
            const { error: visErr } = await supabase.from('retailers').update({ visibility_status: 'live' }).eq('id', retailerId);
            if (visErr) logSupabaseError('invoice.paid retailer: visibility update failed (non-critical)', visErr, { retailerId });
          }
          // Mark primary venue as paid so retailer_is_live() uses the subscription path.
          const { error: venueErr } = await supabase
            .from('retailer_locations')
            .update({ billing_status: 'paid', grace_period_ends_at: null })
            .eq('retailer_id', retailerId)
            .eq('is_primary', true)
            .in('billing_status', ['paid_required', 'free_growth_region']);
          if (venueErr) logSupabaseError('invoice.paid retailer: primary venue billing_status update failed (non-critical)', venueErr, { retailerId });
          const { error: auditErr } = await supabase.from('admin_actions').insert({
            admin_profile_id: null, action_type: 'retailer_subscription_activated',
            target_table: 'retailers', target_id: retailerId,
            reason: `Stripe subscription ${sub.id} activated`,
            metadata_json: { stripe_subscription_id: sub.id },
          });
          if (auditErr) logSupabaseError('invoice.paid retailer: admin_actions insert failed (non-critical)', auditErr, { retailerId });
          console.log('[webhook] invoice.paid retailer: activated', { retailerId, subscriptionId: sub.id });
          break;
        }

        // ── Consumer ──────────────────────────────────────────────────────────
        const userId = sub.metadata?.supabase_user_id ?? null;
        const plan = planInterval(sub);
        const status = mapStripeStatus(sub.status);

        console.log('[webhook] invoice.paid consumer', {
          subscriptionId: sub.id,
          userIdPresent: Boolean(userId),
          plan,
          subStatus: sub.status,
          mappedStatus: status,
          metadataKeys: Object.keys(sub.metadata ?? {}),
        });

        if (!userId) {
          console.warn('[webhook] invoice.paid consumer: no supabase_user_id in subscription metadata — skipping upsert', {
            subscriptionId: sub.id,
            metadataKeys: Object.keys(sub.metadata ?? {}),
          });
          break;
        }

        let payload: Record<string, unknown>;
        try {
          payload = buildMembershipPayload(sub, invoice.customer ?? sub.customer, 'invoice.paid');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[webhook] invoice.paid consumer: date build failed', { error: msg, subscriptionId: sub.id });
          return new Response(`Missing subscription period dates: ${msg}`, { status: 500 });
        }

        console.log('[webhook] invoice.paid consumer: upserting membership', {
          subscriptionId: sub.id,
          planInterval: payload.plan_interval,
          status: payload.status,
          currentPeriodEnd: payload.current_period_end,
          userIdPresent: Boolean(payload.profile_id),
        });

        const { error: upsertErr } = await supabase
          .from('consumer_memberships')
          .upsert(payload, { onConflict: 'stripe_subscription_id' });

        if (upsertErr) {
          logSupabaseError('invoice.paid consumer: upsert failed', upsertErr, {
            subscriptionId: sub.id,
            userIdPresent: Boolean(userId),
          });
          return new Response('DB error: consumer membership upsert', { status: 500 });
        }

        console.log('[webhook] invoice.paid consumer: membership upserted OK', {
          subscriptionId: sub.id,
          plan,
          status,
        });

        // ── Referral reward trigger ────────────────────────────────────────
        // Only fires on the first paid invoice for a new subscription.
        // billing_reason = 'subscription_create' means this is the first charge.
        if (invoice.billing_reason === 'subscription_create') {
          await handleReferralReward(supabase, userId, sub.customer, invoice.amount_paid);
        }

        break;
      }

      // ── invoice.payment_failed ───────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as StripeInvoice;
        const subscriptionId = invoice.subscription;
        console.log('[webhook] invoice.payment_failed', { subscriptionId });
        if (!subscriptionId) break;

        let sub: StripeSubscription;
        try {
          sub = await stripeGet<StripeSubscription>(`subscriptions/${subscriptionId}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[webhook] invoice.payment_failed: subscription retrieve failed', { subscriptionId, error: msg });
          return new Response(`Stripe retrieve error: subscription ${subscriptionId}`, { status: 500 });
        }

        if (sub.metadata?.type === 'retailer_subscription') {
          const retailerId = sub.metadata?.retailer_id;
          if (!retailerId) break;
          const { error } = await supabase
            .from('retailer_subscriptions')
            .update({ status: 'past_due' })
            .eq('retailer_id', retailerId)
            .eq('stripe_subscription_id', subscriptionId);
          if (error) {
            logSupabaseError('invoice.payment_failed retailer: update failed', error, { retailerId, subscriptionId });
            return new Response('DB error: retailer subscription past_due', { status: 500 });
          }
          console.log('[webhook] invoice.payment_failed retailer: past_due', { retailerId, subscriptionId });
          break;
        }

        const { error } = await supabase
          .from('consumer_memberships')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', subscriptionId);
        if (error) {
          logSupabaseError('invoice.payment_failed consumer: update failed', error, { subscriptionId });
          return new Response('DB error: consumer membership past_due', { status: 500 });
        }
        console.log('[webhook] invoice.payment_failed consumer: past_due', { subscriptionId });
        break;
      }

      // ── customer.subscription.updated ───────────────────────────────────────
      // Keeps plan_interval, status, and current_period_end in sync when a
      // subscription is modified (e.g. plan switch, trial conversion, renewal).
      case 'customer.subscription.updated': {
        const sub = event.data.object as StripeSubscription;
        console.log('[webhook] customer.subscription.updated', {
          subscriptionId: sub.id,
          status: sub.status,
          metadataType: sub.metadata?.type ?? null,
        });

        // ── Retailer ──────────────────────────────────────────────────────────
        if (sub.metadata?.type === 'retailer_subscription') {
          const retailerId = sub.metadata?.retailer_id;
          if (!retailerId) break;
          const { periodStart: rPeriodStart, periodEnd: rPeriodEnd } =
            resolvePeriodDates(sub, 'customer.subscription.updated retailer');
          const { error: subErr } = await supabase
            .from('retailer_subscriptions')
            .update({
              status: sub.status === 'active' ? 'active' : sub.status,
              current_period_start: rPeriodStart,
              current_period_end: rPeriodEnd,
              cancel_at_period_end: sub.cancel_at_period_end,
            })
            .eq('retailer_id', retailerId)
            .eq('stripe_subscription_id', sub.id);
          if (subErr) {
            logSupabaseError('customer.subscription.updated retailer: update failed', subErr, { retailerId, subscriptionId: sub.id });
            return new Response('DB error: retailer subscription updated', { status: 500 });
          }
          console.log('[webhook] customer.subscription.updated retailer: synced', { retailerId, subscriptionId: sub.id });
          break;
        }

        // ── Consumer ──────────────────────────────────────────────────────────
        const userId = sub.metadata?.supabase_user_id ?? null;
        if (!userId) {
          console.warn('[webhook] customer.subscription.updated consumer: no supabase_user_id — skipping', {
            subscriptionId: sub.id,
          });
          break;
        }

        let updPayload: Record<string, unknown>;
        try {
          updPayload = buildMembershipPayload(sub, sub.customer, 'customer.subscription.updated');
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[webhook] customer.subscription.updated consumer: date build failed', { error: msg, subscriptionId: sub.id });
          return new Response(`Missing subscription period dates: ${msg}`, { status: 500 });
        }

        const { error: updErr } = await supabase
          .from('consumer_memberships')
          .upsert(updPayload, { onConflict: 'stripe_subscription_id' });

        if (updErr) {
          logSupabaseError('customer.subscription.updated consumer: upsert failed', updErr, { subscriptionId: sub.id });
          return new Response('DB error: consumer membership updated', { status: 500 });
        }
        console.log('[webhook] customer.subscription.updated consumer: synced', { subscriptionId: sub.id });
        break;
      }

      // ── customer.subscription.deleted ───────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as StripeSubscription;
        console.log('[webhook] customer.subscription.deleted', {
          subscriptionId: sub.id,
          metadataType: sub.metadata?.type ?? null,
        });

        if (sub.metadata?.type === 'retailer_subscription') {
          const retailerId = sub.metadata?.retailer_id;
          if (!retailerId) break;
          const graceDays = parseInt(Deno.env.get('RETAILER_GRACE_DAYS') ?? '0', 10);
          const graceDeadline = sub.current_period_end * 1000 + graceDays * 86_400_000;
          const withinGrace = Date.now() < graceDeadline;
          const { error: subErr } = await supabase
            .from('retailer_subscriptions')
            .update({ status: withinGrace ? 'expired' : 'cancelled', cancel_at_period_end: false, ended_at: new Date().toISOString() })
            .eq('retailer_id', retailerId)
            .eq('stripe_subscription_id', sub.id);
          if (subErr) {
            logSupabaseError('customer.subscription.deleted retailer: update failed', subErr, { retailerId, subscriptionId: sub.id });
            return new Response('DB error: retailer subscription cancelled', { status: 500 });
          }
          if (!withinGrace) {
            const { error: visErr } = await supabase.from('retailers').update({ visibility_status: 'hidden' }).eq('id', retailerId);
            if (visErr) logSupabaseError('customer.subscription.deleted retailer: visibility failed (non-critical)', visErr, { retailerId });
            const { error: auditErr } = await supabase.from('admin_actions').insert({
              admin_profile_id: null, action_type: 'retailer_subscription_cancelled',
              target_table: 'retailers', target_id: retailerId,
              reason: `Stripe subscription ${sub.id} deleted`,
              metadata_json: { stripe_subscription_id: sub.id },
            });
            if (auditErr) logSupabaseError('customer.subscription.deleted retailer: audit failed (non-critical)', auditErr, { retailerId });
          }
          console.log('[webhook] customer.subscription.deleted retailer', { retailerId, subscriptionId: sub.id, withinGrace });
          break;
        }

        const { error } = await supabase
          .from('consumer_memberships')
          .update({ status: 'cancelled', cancel_at_period_end: false, ended_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id);
        if (error) {
          logSupabaseError('customer.subscription.deleted consumer: update failed', error, { subscriptionId: sub.id });
          return new Response('DB error: consumer membership cancelled', { status: 500 });
        }
        console.log('[webhook] customer.subscription.deleted consumer: cancelled', { subscriptionId: sub.id });
        break;
      }

      default:
        console.log(`[webhook] unhandled event type: ${event.type}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[webhook] unhandled exception:', msg);
    return new Response(`Internal error: ${msg}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
