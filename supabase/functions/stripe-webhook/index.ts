import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.0.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Stripe webhook handler.
 *
 * Handles:
 *   invoice.paid                   → mark membership active, update period dates
 *   invoice.payment_failed         → mark membership past_due
 *   customer.subscription.deleted  → mark membership cancelled
 *
 * Required env vars:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
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
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
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

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;
        if (!subscriptionId) break;

        await supabase
          .from('consumer_memberships')
          .update({ status: 'past_due' })
          .eq('stripe_subscription_id', subscriptionId);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;

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
