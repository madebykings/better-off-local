'use server';

import { randomBytes } from 'crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';

export type InviteActionState = { error: string | null; success?: boolean } | null;

const INVITE_TTL_DAYS = 7;

// ── Helpers ───────────────────────────────────────────────────────────────────

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';
}

// ── Owner/manager actions ─────────────────────────────────────────────────────

/**
 * Generate a new reusable scanner invite link for this retailer.
 * Any existing active invite for the same retailer is revoked first
 * so only one active link exists at a time.
 */
export async function createInviteLink(
  _prevState: InviteActionState,
  _formData: FormData,
): Promise<InviteActionState> {
  const { retailerId, accessRole } = await requireRetailerUser();

  if (accessRole === 'scanner_only' || accessRole === 'staff') {
    return { error: 'Only owners and managers can create invite links.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const service = createServiceClient();

  // Revoke any existing active links for this retailer.
  await service
    .from('scanner_invites')
    .update({ is_revoked: true })
    .eq('retailer_id', retailerId)
    .eq('is_revoked', false);

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await service.from('scanner_invites').insert({
    retailer_id: retailerId,
    created_by: user.id,
    token,
    expires_at: expiresAt,
  });

  if (error) {
    console.error('createInviteLink error:', error.message);
    return { error: 'Could not create invite link. Please try again.' };
  }

  revalidatePath('/team');
  return { error: null, success: true };
}

/**
 * Revoke a scanner invite link. Accepted staff accounts are NOT removed.
 * Reads inviteId from formData so it can be used directly with useActionState.
 */
export async function revokeInviteLink(
  _prevState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const inviteId = formData.get('inviteId') as string | null;
  if (!inviteId) return { error: 'Invalid request.' };

  const { retailerId, accessRole } = await requireRetailerUser();

  if (accessRole === 'scanner_only' || accessRole === 'staff') {
    return { error: 'Only owners and managers can revoke invite links.' };
  }

  const service = createServiceClient();

  const { error } = await service
    .from('scanner_invites')
    .update({ is_revoked: true })
    .eq('id', inviteId)
    .eq('retailer_id', retailerId); // scope to this retailer

  if (error) {
    console.error('revokeInviteLink error:', error.message);
    return { error: 'Could not revoke invite link.' };
  }

  revalidatePath('/team');
  return { error: null, success: true };
}

// ── Staff-facing actions (called from invite pages, unauthenticated) ──────────

/**
 * Send a magic-link email so the staff member can sign in without a password.
 * Validates the invite token before sending to avoid sending OTPs for
 * expired or revoked links.
 *
 * Call via: requestMagicLink.bind(null, token)
 */
export async function requestMagicLink(
  token: string,
  _prevState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const email = (formData.get('email') as string | null)?.trim().toLowerCase();
  if (!email) return { error: 'Email is required.' };

  // Validate the invite before we spend an OTP send.
  const service = createServiceClient();
  const { data: invite } = await service
    .from('scanner_invites')
    .select('id, expires_at, is_revoked, max_uses, use_count')
    .eq('token', token)
    .maybeSingle();

  if (!invite || invite.is_revoked || new Date(invite.expires_at) < new Date()) {
    return { error: 'This invite link has expired or is no longer valid.' };
  }

  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    return { error: 'This invite link has reached its maximum number of uses.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback?invite=${encodeURIComponent(token)}`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error('requestMagicLink signInWithOtp error:', error.message);
    return { error: 'Could not send sign-in link. Please try again.' };
  }

  return { error: null, success: true };
}

/**
 * Validate an invite token and attach the authenticated user to the retailer
 * as a scanner_only staff member. Increments the invite use_count.
 *
 * Called from the auth callback and the setup page after display name is saved.
 */
export async function acceptInvite(
  token: string,
  userId: string,
): Promise<{ error: string | null }> {
  const service = createServiceClient();

  const { data: invite } = await service
    .from('scanner_invites')
    .select('id, retailer_id, expires_at, is_revoked, max_uses, use_count')
    .eq('token', token)
    .maybeSingle();

  if (!invite || invite.is_revoked || new Date(invite.expires_at) < new Date()) {
    return { error: 'This invite link has expired or is no longer valid.' };
  }

  if (invite.max_uses !== null && invite.use_count >= invite.max_uses) {
    return { error: 'This invite link has reached its maximum number of uses.' };
  }

  // Upsert the retailer_users row. ON CONFLICT re-activates a previously
  // removed scanner account for the same user+retailer combination.
  const { error: linkError } = await service.from('retailer_users').upsert(
    {
      retailer_id: invite.retailer_id,
      profile_id: userId,
      access_role: 'scanner_only',
      is_active: true,
    },
    { onConflict: 'retailer_id,profile_id' },
  );

  if (linkError) {
    console.error('acceptInvite retailer_users upsert error:', linkError.message);
    return { error: 'Could not link your account. Please try again.' };
  }

  // Increment use_count.
  await service
    .from('scanner_invites')
    .update({ use_count: invite.use_count + 1 })
    .eq('id', invite.id);

  return { error: null };
}

/**
 * Save the staff member's display name then accept the invite.
 * Redirects to /scan on success.
 *
 * Call via: saveDisplayNameAndAccept.bind(null, token)
 */
export async function saveDisplayNameAndAccept(
  token: string,
  _prevState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const name = (formData.get('name') as string | null)?.trim();

  if (!name || name.length < 1) return { error: 'Please enter your name.' };
  if (name.length > 100) return { error: 'Name must be 100 characters or fewer.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Session expired. Please open the invite link again.' };
  }

  const service = createServiceClient();

  const { error: profileError } = await service
    .from('profiles')
    .update({ full_name: name })
    .eq('id', user.id);

  if (profileError) {
    console.error('saveDisplayNameAndAccept profile error:', profileError.message);
    return { error: 'Could not save your name. Please try again.' };
  }

  const { error: acceptError } = await acceptInvite(token, user.id);
  if (acceptError) return { error: acceptError };

  redirect('/scan');
}
