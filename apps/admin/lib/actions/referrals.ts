'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export async function voidReferralReward(formData: FormData) {
  const { userId } = await requireAdmin();
  const rewardId = formData.get('reward_id') as string;
  const reason = (formData.get('reason') as string | null) ?? 'Voided by admin';

  const supabase = createServiceClient();

  await supabase
    .from('referral_rewards')
    .update({
      status: 'voided',
      voided_at: new Date().toISOString(),
      void_reason: reason,
    })
    .eq('id', rewardId);

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: 'referral_reward_voided',
    target_table: 'referral_rewards',
    target_id: rewardId,
    reason,
    metadata_json: null,
  });

  revalidatePath('/referrals');
}

export async function approveReferralReward(formData: FormData) {
  const { userId } = await requireAdmin();
  const rewardId = formData.get('reward_id') as string;

  const supabase = createServiceClient();

  // Fetch reward to apply Stripe credit
  const { data: rewardRaw } = await supabase
    .from('referral_rewards')
    .select('id, reward_amount_pence, referrer_profile_id')
    .eq('id', rewardId)
    .single();

  const reward = rewardRaw as { id: string; reward_amount_pence: number; referrer_profile_id: string } | null;

  if (!reward) {
    console.error('[approveReferralReward] reward not found:', rewardId);
    revalidatePath('/referrals');
    return;
  }

  // Look up referrer Stripe customer ID
  const { data: membership } = await supabase
    .from('consumer_memberships')
    .select('stripe_customer_id')
    .eq('profile_id', reward.referrer_profile_id)
    .in('status', ['active', 'trialing'])
    .maybeSingle();

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (secretKey && membership?.stripe_customer_id) {
    const params = new URLSearchParams({
      amount: String(-reward.reward_amount_pence),
      currency: 'gbp',
      description: 'Referral reward (admin approved)',
    });

    const stripeRes = await fetch(
      `https://api.stripe.com/v1/customers/${membership.stripe_customer_id}/balance_transactions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );

    if (stripeRes.ok) {
      const txn = await stripeRes.json();
      await supabase
        .from('referral_rewards')
        .update({
          status: 'applied',
          stripe_balance_txn_id: txn.id,
          applied_at: new Date().toISOString(),
        })
        .eq('id', rewardId);
    } else {
      // Mark confirmed even if Stripe fails — admin can retry manually
      await supabase
        .from('referral_rewards')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', rewardId);
      console.error('[approveReferralReward] Stripe credit failed for reward', rewardId);
    }
  } else {
    await supabase
      .from('referral_rewards')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', rewardId);
  }

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: 'referral_reward_approved',
    target_table: 'referral_rewards',
    target_id: rewardId,
    reason: 'Manually approved from review queue',
    metadata_json: null,
  });

  revalidatePath('/referrals');
}
