import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * check-referral-eligibility
 *
 * Invoked by a Supabase cron job (daily recommended) or manually via the
 * admin portal. Promotes pending referral rewards to "eligible" once the
 * qualifying subscription has been active for 30 days.
 *
 * Qualification rules:
 *   Member reward: referral_rewards.created_at is ≥ 30 days ago AND the
 *     invitee's consumer_membership is still active/trialing.
 *   Venue reward:  referral_rewards.created_at is ≥ 30 days ago AND the
 *     retailer_subscriptions row is still active.
 *
 * Idempotent — running multiple times is safe.
 *
 * Required env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env:
 *   ELIGIBILITY_DAYS (default: 30)
 */

serve(async (req) => {
  // Allow GET for manual health-check / cron invocation, POST for admin trigger.
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    console.error('[eligibility] FATAL: missing Supabase env vars');
    return new Response('Server misconfigured', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const eligibilityDays = parseInt(Deno.env.get('ELIGIBILITY_DAYS') ?? '30', 10);
  const cutoff = new Date(Date.now() - eligibilityDays * 86_400_000).toISOString();

  console.log('[eligibility] running check', { eligibilityDays, cutoff });

  let memberPromoted = 0;
  let venuePromoted = 0;
  let errors = 0;

  // ── Member rewards ──────────────────────────────────────────────────────────

  const { data: pendingMember, error: memberFetchErr } = await supabase
    .from('referral_rewards')
    .select('id, referral_invitation_id, referral_invitations!inner(invitee_profile_id)')
    .eq('reward_type', 'member')
    .eq('status', 'pending')
    .lte('created_at', cutoff);

  if (memberFetchErr) {
    console.error('[eligibility] failed to fetch pending member rewards', { error: memberFetchErr.message });
    errors++;
  } else {
    for (const reward of (pendingMember ?? [])) {
      const inviteeProfileId = (reward.referral_invitations as { invitee_profile_id: string } | null)?.invitee_profile_id;
      if (!inviteeProfileId) {
        console.warn('[eligibility] member reward missing invitee profile', { rewardId: reward.id });
        continue;
      }

      // Invitee must still have an active/trialing membership
      const { data: membership } = await supabase
        .from('consumer_memberships')
        .select('id')
        .eq('profile_id', inviteeProfileId)
        .in('status', ['active', 'trialing'])
        .maybeSingle();

      if (!membership) {
        console.log('[eligibility] member reward not eligible: no active membership', { rewardId: reward.id, inviteeProfileId });
        continue;
      }

      const { error: updateErr } = await supabase
        .from('referral_rewards')
        .update({ status: 'eligible', eligible_at: new Date().toISOString() })
        .eq('id', reward.id)
        .eq('status', 'pending'); // guard against concurrent runs

      if (updateErr) {
        console.error('[eligibility] failed to promote member reward', { rewardId: reward.id, error: updateErr.message });
        errors++;
      } else {
        memberPromoted++;
        console.log('[eligibility] member reward eligible', { rewardId: reward.id });
      }
    }
  }

  // ── Venue rewards ───────────────────────────────────────────────────────────

  const { data: pendingVenue, error: venueFetchErr } = await supabase
    .from('referral_rewards')
    .select('id, referred_retailer_id')
    .eq('reward_type', 'venue')
    .eq('status', 'pending')
    .lte('created_at', cutoff);

  if (venueFetchErr) {
    console.error('[eligibility] failed to fetch pending venue rewards', { error: venueFetchErr.message });
    errors++;
  } else {
    for (const reward of (pendingVenue ?? [])) {
      if (!reward.referred_retailer_id) continue;

      // Retailer must still have an active subscription
      const { data: sub } = await supabase
        .from('retailer_subscriptions')
        .select('id')
        .eq('retailer_id', reward.referred_retailer_id)
        .eq('status', 'active')
        .maybeSingle();

      if (!sub) {
        console.log('[eligibility] venue reward not eligible: no active subscription', { rewardId: reward.id, retailerId: reward.referred_retailer_id });
        continue;
      }

      const { error: updateErr } = await supabase
        .from('referral_rewards')
        .update({ status: 'eligible', eligible_at: new Date().toISOString() })
        .eq('id', reward.id)
        .eq('status', 'pending');

      if (updateErr) {
        console.error('[eligibility] failed to promote venue reward', { rewardId: reward.id, error: updateErr.message });
        errors++;
      } else {
        venuePromoted++;
        console.log('[eligibility] venue reward eligible', { rewardId: reward.id });
      }
    }
  }

  const result = { memberPromoted, venuePromoted, errors };
  console.log('[eligibility] complete', result);

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
    status: errors > 0 ? 207 : 200,
  });
});
