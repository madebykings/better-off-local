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
 * Sends a transactional email to the retailer owner on approval status changes.
 *
 * Uses Resend (https://resend.com). Requires the RESEND_API_KEY and
 * RESEND_FROM_EMAIL environment variables. Silently skips if unconfigured so
 * the admin action itself never fails due to a missing email provider.
 *
 * Required env vars:
 *   RESEND_API_KEY    — Resend API key (re_...)
 *   RESEND_FROM_EMAIL — Verified sender address (e.g. hello@betterofflocal.com)
 */
async function notifyRetailerApprovalStatus(
  retailerId: string,
  action: 'approved' | 'rejected' | 'changes_requested',
  note?: string,
) {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.log('[notifyRetailerApprovalStatus] RESEND_API_KEY or RESEND_FROM_EMAIL not set — skipping email', { retailerId, action });
    return;
  }

  const supabase = createServiceClient();

  // Fetch the retailer name + primary owner email.
  const { data: ownerRow } = await supabase
    .from('retailer_users')
    .select('profiles(full_name, email), retailers(name)')
    .eq('retailer_id', retailerId)
    .eq('access_role', 'owner')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  const row = ownerRow as any;
  const toEmail = (row?.profiles?.email ?? row?.profiles?.[0]?.email) as string | null | undefined;
  const ownerName = (row?.profiles?.full_name ?? row?.profiles?.[0]?.full_name ?? 'there') as string;
  const retailerName = (row?.retailers?.name ?? row?.retailers?.[0]?.name ?? 'your business') as string;

  if (!toEmail) {
    console.warn('[notifyRetailerApprovalStatus] no owner email found for retailer', { retailerId });
    return;
  }

  const subjects: Record<typeof action, string> = {
    approved:           `Your Better Off Local listing has been approved`,
    rejected:           `Update on your Better Off Local application`,
    changes_requested:  `Action required: changes needed for your listing`,
  };

  const bodies: Record<typeof action, string> = {
    approved: `Hi ${ownerName},\n\nGreat news — your Better Off Local listing for ${retailerName} has been approved.\n\nYou can now complete your setup and activate your subscription to go live on the platform.\n\nSign in to your retailer portal to continue:\nhttps://portal.betterofflocal.com\n\nWelcome to Better Off Local!\n\nThe Better Off Local team`,
    rejected: `Hi ${ownerName},\n\nThank you for applying to join Better Off Local.\n\nAfter reviewing your application for ${retailerName}, we're unable to approve it at this time.${note ? `\n\nFeedback: ${note}` : ''}\n\nIf you have questions, please reply to this email.\n\nThe Better Off Local team`,
    changes_requested: `Hi ${ownerName},\n\nThank you for submitting your Better Off Local listing for ${retailerName}.\n\nWe've reviewed your application and need a few changes before we can approve it.${note ? `\n\nFeedback: ${note}` : ''}\n\nPlease sign in to your retailer portal to make the updates and resubmit:\nhttps://portal.betterofflocal.com\n\nThe Better Off Local team`,
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: subjects[action],
        text: bodies[action],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('[notifyRetailerApprovalStatus] Resend error', { status: res.status, body, retailerId, action });
    } else {
      console.log('[notifyRetailerApprovalStatus] email sent', { retailerId, action, toEmail });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[notifyRetailerApprovalStatus] fetch error', { error: msg, retailerId, action });
  }
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

  // Determine visibility and primary venue billing_status based on region.
  // If no region is set on the primary venue, default to free_growth_region and go live.
  const { data: primaryVenue } = await supabase
    .from('retailer_locations')
    .select('id, region_id')
    .eq('retailer_id', retailerId)
    .eq('is_primary', true)
    .eq('is_active', true)
    .maybeSingle();

  let billingStatus: string = 'free_growth_region';
  let visibilityStatus: string = 'live';

  if (primaryVenue?.region_id) {
    const { data: region } = await supabase
      .from('regions')
      .select('member_threshold')
      .eq('id', primaryVenue.region_id)
      .maybeSingle();

    const { data: activeCount } = await supabase
      .rpc('region_active_member_count', { p_region_id: primaryVenue.region_id });

    const threshold = region?.member_threshold ?? 100;
    const count = (activeCount as number | null) ?? 0;

    if (count >= threshold) {
      billingStatus = 'paid_required';
      visibilityStatus = 'draft';
    }
  }

  await supabase
    .from('retailers')
    .update({
      approval_status: 'approved',
      visibility_status: visibilityStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', retailerId);

  if (primaryVenue) {
    await supabase
      .from('retailer_locations')
      .update({ billing_status: billingStatus })
      .eq('id', primaryVenue.id);
  }

  await logAdminAction({
    adminId: userId,
    actionType: 'retailer_approved',
    targetTable: 'retailers',
    targetId: retailerId,
    reason: reason ?? (billingStatus === 'free_growth_region'
      ? 'Approved — growth region, listed for free'
      : 'Approved — region above threshold, subscription required'),
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
