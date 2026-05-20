import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Stripe webhook handler.
 *
 * Consumer membership events:
 *   invoice.paid                   → mark membership active, update period dates
 *   invoice.payment_failed         → mark membership past_due
 *   customer.subscription.deleted  → mark membership cancelled
 *
 * Retailer subscription events (identified by subscription metadata.type = 'retailer_subscription'):
 *   checkout.session.completed     → link stripe_subscription_id to retailer_subscriptions row
 *   invoice.paid                   → mark subscription active, set visibility_status=live
 *   invoice.payment_failed         → mark subscription past_due (stay live during grace period)
 *   customer.subscription.deleted  → mark subscription cancelled/expired, hide retailer
 *                                    unless within RETAILER_GRACE_DAYS of period end
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   RETAILER_GRACE_DAYS            — days after period_end before hiding on cancellation (default: 0)
 */

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    switch (event.type) {
      // ── checkout.session.completed ──────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.type !== 'retailer_subscription') break;

        const retailerId = session.metadata?.retailer_id;
        const subscriptionId = session.subscription as string;
        if (!retailerId || !subscriptionId) break;

        // Link the Stripe subscription ID to the pending row we created during checkout.
        await supabase
          .from('retailer_subscriptions')
          .update({ stripe_subscription_id: subscriptionId })
          .eq('retailer_id', retailerId)
          .eq('stripe_checkout_session_id', session.id);
        break;
      }

      // ── invoice.paid ────────────────────────────────────────────────────────
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        // ── Retailer subscription ─────────────────────────────────────────────
        if (sub.metadata?.type === 'retailer_subscription') {
          const retailerId = sub.metadata?.retailer_id;
          if (!retailerId) {
            console.warn('invoice.paid (retailer): no retailer_id in subscription metadata');
            break;
          }

          await supabase
            .from('retailer_subscriptions')
            .update({
              stripe_subscription_id: sub.id,
              status: 'active',
              current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              cancel_at_period_end: sub.cancel_at_period_end,
              started_at: new Date(sub.start_date * 1000).toISOString(),
              ended_at: null,
            })
            .eq('retailer_id', retailerId)
            .eq('stripe_subscription_id', sub.id);

          // Set live only when approved + subscription now active.
          const { data: retailer } = await supabase
            .from('retailers')
            .select('approval_status')
            .eq('id', retailerId)
            .single();

          if (retailer?.approval_status === 'approved') {
            await supabase
              .from('retailers')
              .update({ visibility_status: 'live' })
              .eq('id', retailerId);
          }

          await supabase.from('admin_actions').insert({
            admin_profile_id: null,
            action_type: 'retailer_subscription_activated',
            target_table: 'retailers',
            target_id: retailerId,
            reason: `Stripe subscription ${sub.id} activated`,
            metadata_json: { stripe_subscription_id: sub.id },
          });

          break;
        }

        // ── Consumer membership (existing logic) ───────────────────────────────
        const userId = sub.metadata?.supabase_user_id;
        if (!userId) {
          console.warn('invoice.paid: no supabase_user_id in subscription metadata');
          break;
        }

        const interval = sub.items.data[0]?.price?.recurring?.interval;
        const planInterval = interval === 'year' ? 'annual' : 'monthly';

        await supabase.from('consumer_memberships').upsert(
          {
            profile_id: userId,
            stripe_customer_id: invoice.customer as string,
            stripe_subscription_id: sub.id,
            plan_interval: planInterval,
            status: 'active',
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            cancel_at_period_end: sub.cancel_at_period_end,
            started_at: new Date(sub.start_date * 1000).toISOString(),
            ended_at: null,
          },
          { onConflict: 'stripe_subscription_id' },
        );
        break;
      }

      // ── invoice.payment_failed ───────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        // ── Retailer subscription ─────────────────────────────────────────────
        if (sub.metadata?.type === 'retailer_subscription') {
          const retailerId = sub.metadata?.retailer_id;
          if (!retailerId) break;

          await supabase
            .from('retailer_subscriptions')
            .update({ status: 'past_due' })
            .eq('retailer_id', retailerId)
            .eq('stripe_subscription_id', subscriptionId);

          // Retailer stays live during Stripe's dunning / grace period.
          // They will be hidden only if subscription is deleted (customer.subscription.deleted).
          break;
        }

        // ── Consumer membership ───────────────────────────────────────────────
        await supabase
          .from('consumer_memberships')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', subscriptionId);
        break;
      }

      // ── customer.subscription.deleted ───────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;

        // ── Retailer subscription ─────────────────────────────────────────────
        if (sub.metadata?.type === 'retailer_subscription') {
          const retailerId = sub.metadata?.retailer_id;
          if (!retailerId) break;

          const graceDays = parseInt(Deno.env.get('RETAILER_GRACE_DAYS') ?? '0', 10);
          const periodEnd = sub.current_period_end * 1000;
          const graceDeadline = periodEnd + graceDays * 86_400_000;
          const withinGrace = Date.now() < graceDeadline;

          const endedAt = new Date().toISOString();

          await supabase
            .from('retailer_subscriptions')
            .update({
              status: withinGrace ? 'expired' : 'cancelled',
              cancel_at_period_end: false,
              ended_at: endedAt,
            })
            .eq('retailer_id', retailerId)
            .eq('stripe_subscription_id', sub.id);

          if (!withinGrace) {
            await supabase
              .from('retailers')
              .update({ visibility_status: 'hidden' })
              .eq('id', retailerId);

            await supabase.from('admin_actions').insert({
              admin_profile_id: null,
              action_type: 'retailer_subscription_cancelled',
              target_table: 'retailers',
              target_id: retailerId,
              reason: `Stripe subscription ${sub.id} deleted`,
              metadata_json: { stripe_subscription_id: sub.id },
            });
          }

          break;
        }

        // ── Consumer membership ───────────────────────────────────────────────
        await supabase
          .from('consumer_memberships')
          .update({
            status: 'cancelled',
            cancel_at_period_end: false,
            ended_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', sub.id);
        break;
      }

      default:
        // Unhandled event types — log and return 200 to prevent Stripe retries.
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('Error processing webhook event:', err);
    return new Response('Internal error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
