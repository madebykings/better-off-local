'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function logAdminAction(params: {
  adminId: string;
  actionType: string;
  targetTable: string;
  targetId: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServiceClient();
  await supabase.from('admin_actions').insert({
    admin_profile_id: params.adminId,
    action_type: params.actionType,
    target_table: params.targetTable,
    target_id: params.targetId,
    reason: params.reason ?? null,
    metadata_json: params.metadata ?? null,
  });
}

/**
 * Placeholder notification hook.
 *
 * TODO: Replace with real email/notification dispatch (e.g. Resend, Postmark).
 * Called after every approval status transition so the integration point is
 * established even before the email provider is wired up.
 */
async function notifyRetailerApprovalStatus(
  retailerId: string,
  action: 'approved' | 'rejected' | 'changes_requested',
  note?: string,
) {
  // TODO: look up retailer owner email, dispatch transactional email
  console.log('[notifyRetailerApprovalStatus] stub', { retailerId, action, note });
}

// ─── Retailer actions ─────────────────────────────────────────────────────────

export async function approveRetailer(retailerId: string, reason?: string) {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();

  // Idempotent guard.
  const { data: current } = await supabase
    .from('retailers')
    .select('approval_status')
    .eq('id', retailerId)
    .single();
  if (current?.approval_status === 'approved') return;

  // NOTE: visibility_status is deliberately NOT set to 'live' here.
  // A retailer goes live when approved + active subscription (enforced elsewhere).
  await supabase
    .from('retailers')
    .update({
      approval_status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', retailerId);

  await logAdminAction({
    adminId: userId,
    actionType: 'retailer_approved',
    targetTable: 'retailers',
    targetId: retailerId,
    reason,
  });

  await notifyRetailerApprovalStatus(retailerId, 'approved');

  revalidatePath('/retailers');
  revalidatePath(`/retailers/${retailerId}`);
  revalidatePath('/review');
}

export async function rejectRetailer(retailerId: string, note: string) {
  if (!note?.trim()) return; // server-side guard — note is required

  const { userId } = await requireAdmin();
  const supabase = createServiceClient();

  // Idempotent guard.
  const { data: current } = await supabase
    .from('retailers')
    .select('approval_status')
    .eq('id', retailerId)
    .single();
  if (current?.approval_status === 'rejected') return;

  await supabase
    .from('retailers')
    .update({
      approval_status: 'rejected',
      visibility_status: 'hidden',
      updated_at: new Date().toISOString(),
    })
    .eq('id', retailerId);

  await logAdminAction({
    adminId: userId,
    actionType: 'retailer_rejected',
    targetTable: 'retailers',
    targetId: retailerId,
    reason: note,
  });

  await notifyRetailerApprovalStatus(retailerId, 'rejected', note);

  revalidatePath('/retailers');
  revalidatePath(`/retailers/${retailerId}`);
  revalidatePath('/review');
}

export async function requestRetailerChanges(retailerId: string, note: string) {
  if (!note?.trim()) return; // server-side guard — note is required

  const { userId } = await requireAdmin();
  const supabase = createServiceClient();

  // Idempotent guard.
  const { data: current } = await supabase
    .from('retailers')
    .select('approval_status')
    .eq('id', retailerId)
    .single();
  if (current?.approval_status === 'changes_requested') return;

  await supabase
    .from('retailers')
    .update({
      approval_status: 'changes_requested',
      visibility_status: 'hidden',
      updated_at: new Date().toISOString(),
    })
    .eq('id', retailerId);

  await logAdminAction({
    adminId: userId,
    actionType: 'retailer_changes_requested',
    targetTable: 'retailers',
    targetId: retailerId,
    reason: note,
  });

  await notifyRetailerApprovalStatus(retailerId, 'changes_requested', note);

  revalidatePath('/retailers');
  revalidatePath(`/retailers/${retailerId}`);
  revalidatePath('/review');
}

export async function suspendRetailer(retailerId: string, reason?: string) {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();

  // Idempotent guard.
  const { data: current } = await supabase
    .from('retailers')
    .select('approval_status')
    .eq('id', retailerId)
    .single();
  if (current?.approval_status === 'suspended') return;

  await supabase
    .from('retailers')
    .update({
      approval_status: 'suspended',
      visibility_status: 'hidden',
      updated_at: new Date().toISOString(),
    })
    .eq('id', retailerId);

  await logAdminAction({
    adminId: userId,
    actionType: 'retailer_suspended',
    targetTable: 'retailers',
    targetId: retailerId,
    reason,
  });

  revalidatePath('/retailers');
  revalidatePath(`/retailers/${retailerId}`);
}

export async function setRetailerVisibility(
  retailerId: string,
  visibility: 'live' | 'hidden' | 'draft',
  reason?: string,
) {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();

  await supabase
    .from('retailers')
    .update({ visibility_status: visibility, updated_at: new Date().toISOString() })
    .eq('id', retailerId);

  await logAdminAction({
    adminId: userId,
    actionType: `retailer_visibility_set_${visibility}`,
    targetTable: 'retailers',
    targetId: retailerId,
    reason,
  });

  revalidatePath('/retailers');
  revalidatePath(`/retailers/${retailerId}`);
}

// ─── Offer actions ────────────────────────────────────────────────────────────

export async function approveOffer(offerId: string, reason?: string) {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();

  // Approve and set live in one step (conditions satisfied by admin decision).
  await supabase
    .from('offers')
    .update({ status: 'live', updated_at: new Date().toISOString() })
    .eq('id', offerId);

  await logAdminAction({
    adminId: userId,
    actionType: 'offer_approved',
    targetTable: 'offers',
    targetId: offerId,
    reason,
  });

  revalidatePath('/offers');
  revalidatePath(`/offers/${offerId}`);
}

export async function rejectOffer(offerId: string, reason?: string) {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();

  await supabase
    .from('offers')
    .update({ status: 'rejected', updated_at: new Date().toISOString() })
    .eq('id', offerId);

  await logAdminAction({
    adminId: userId,
    actionType: 'offer_rejected',
    targetTable: 'offers',
    targetId: offerId,
    reason,
  });

  revalidatePath('/offers');
  revalidatePath(`/offers/${offerId}`);
}

export async function pauseOffer(offerId: string, reason?: string) {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();

  await supabase
    .from('offers')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', offerId);

  await logAdminAction({
    adminId: userId,
    actionType: 'offer_paused',
    targetTable: 'offers',
    targetId: offerId,
    reason,
  });

  revalidatePath('/offers');
  revalidatePath(`/offers/${offerId}`);
}

export async function reinstateOffer(offerId: string, reason?: string) {
  const { userId } = await requireAdmin();
  const supabase = createServiceClient();

  await supabase
    .from('offers')
    .update({ status: 'live', updated_at: new Date().toISOString() })
    .eq('id', offerId);

  await logAdminAction({
    adminId: userId,
    actionType: 'offer_reinstated',
    targetTable: 'offers',
    targetId: offerId,
    reason,
  });

  revalidatePath('/offers');
  revalidatePath(`/offers/${offerId}`);
}
