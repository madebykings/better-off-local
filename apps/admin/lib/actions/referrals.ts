'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export async function markReferralPaid(formData: FormData) {
  const { userId } = await requireAdmin();
  const rewardId = formData.get('reward_id') as string;
  const notes = (formData.get('notes') as string | null) ?? null;

  if (!rewardId) return;

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('referral_rewards')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: userId,
      notes: notes ?? undefined,
    })
    .eq('id', rewardId)
    .eq('status', 'eligible'); // only eligible rewards can be marked paid

  if (error) {
    console.error('[markReferralPaid] update failed:', error.message, { rewardId });
    return;
  }

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: 'referral_reward_paid',
    target_table: 'referral_rewards',
    target_id: rewardId,
    reason: notes ?? 'Marked paid by admin',
    metadata_json: null,
  });

  revalidatePath('/referrals');
}

export async function cancelReferralReward(formData: FormData) {
  const { userId } = await requireAdmin();
  const rewardId = formData.get('reward_id') as string;
  const reason = (formData.get('reason') as string | null) ?? 'Cancelled by admin';

  if (!rewardId) return;

  const supabase = createServiceClient();

  await supabase
    .from('referral_rewards')
    .update({
      status: 'cancelled',
      notes: reason,
    })
    .eq('id', rewardId)
    .in('status', ['pending', 'eligible']);

  await supabase.from('admin_actions').insert({
    admin_profile_id: userId,
    action_type: 'referral_reward_cancelled',
    target_table: 'referral_rewards',
    target_id: rewardId,
    reason,
    metadata_json: null,
  });

  revalidatePath('/referrals');
}

export async function triggerEligibilityCheck() {
  const { userId } = await requireAdmin();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('[triggerEligibilityCheck] missing env vars');
    return { error: 'Server misconfigured' };
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/check-referral-eligibility`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${serviceKey}` },
  });

  const data = await res.json().catch(() => ({}));
  console.log('[triggerEligibilityCheck] result', { userId, ...data });

  revalidatePath('/referrals');
  return data;
}
