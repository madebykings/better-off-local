'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';

export type TeamActionState = { error: string | null; success?: boolean } | null;

const INVITE_TTL_DAYS = 7;

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';
}

export async function inviteMember(
  _prevState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const email = (formData.get('email') as string | null)?.trim().toLowerCase();
  const role = formData.get('role') as string | null;

  if (!email) return { error: 'Email is required.' };
  if (!role || !['manager', 'scanner_only'].includes(role)) {
    return { error: 'Please select a valid role.' };
  }

  const { retailerId, accessRole } = await requireRetailerUser();

  if (accessRole !== 'owner' && accessRole !== 'manager') {
    return { error: 'Only owners and managers can invite team members.' };
  }
  // Managers can only invite scanners.
  if (accessRole === 'manager' && role !== 'scanner_only') {
    return { error: 'Managers can only invite scanner accounts.' };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const service = createServiceClient();

  // Check if this email is already an active member.
  const { data: existingProfile } = await service
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingProfile) {
    const { data: existingMember } = await service
      .from('retailer_users')
      .select('id')
      .eq('retailer_id', retailerId)
      .eq('profile_id', existingProfile.id)
      .eq('is_active', true)
      .maybeSingle();

    if (existingMember) {
      return { error: 'This person is already a member of your team.' };
    }
  }

  // Revoke any pending invite for the same email to this retailer.
  await service
    .from('retailer_invitations')
    .update({ status: 'revoked' })
    .eq('retailer_id', retailerId)
    .eq('email', email)
    .eq('status', 'pending');

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await service.from('retailer_invitations').insert({
    retailer_id: retailerId,
    invited_by: user.id,
    email,
    role,
    token,
    expires_at: expiresAt,
  });

  if (error) {
    console.error('[inviteMember] insert error:', error.message);
    return { error: 'Could not create invite. Please try again.' };
  }

  // Send a magic-link OTP so the invitee can click straight in.
  const authClient = await createClient();
  await authClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback?team_invite=${encodeURIComponent(token)}`,
      shouldCreateUser: true,
    },
  });

  revalidatePath('/team');
  return { error: null, success: true };
}

export async function revokeInvitation(
  _prevState: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const inviteId = formData.get('inviteId') as string | null;
  if (!inviteId) return { error: 'Invalid request.' };

  const { retailerId, accessRole } = await requireRetailerUser();
  if (accessRole !== 'owner' && accessRole !== 'manager') {
    return { error: 'Only owners and managers can revoke invites.' };
  }

  const service = createServiceClient();
  const { error } = await service
    .from('retailer_invitations')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('retailer_id', retailerId);

  if (error) {
    console.error('[revokeInvitation] error:', error.message);
    return { error: 'Could not revoke invite.' };
  }

  revalidatePath('/team');
  return { error: null, success: true };
}

export async function changeRole(memberId: string, newRole: string): Promise<TeamActionState> {
  const validRoles = ['owner', 'manager', 'scanner_only'];
  if (!validRoles.includes(newRole)) return { error: 'Invalid role.' };

  const { retailerId, accessRole, userId } = await requireRetailerUser();
  if (accessRole !== 'owner') {
    return { error: 'Only owners can change member roles.' };
  }

  const service = createServiceClient();

  // Don't allow changing own role.
  const { data: member } = await service
    .from('retailer_users')
    .select('profile_id, access_role')
    .eq('id', memberId)
    .eq('retailer_id', retailerId)
    .maybeSingle();

  if (!member) return { error: 'Member not found.' };
  if (member.profile_id === userId) return { error: 'You cannot change your own role.' };

  const { error } = await service
    .from('retailer_users')
    .update({ access_role: newRole })
    .eq('id', memberId)
    .eq('retailer_id', retailerId);

  if (error) {
    console.error('[changeRole] error:', error.message);
    return { error: 'Could not change role. Please try again.' };
  }

  revalidatePath('/team');
  return { error: null, success: true };
}

export async function removeMember(memberId: string): Promise<TeamActionState> {
  const { retailerId, accessRole, userId } = await requireRetailerUser();
  if (accessRole !== 'owner' && accessRole !== 'manager') {
    return { error: 'Only owners and managers can remove members.' };
  }

  const service = createServiceClient();

  const { data: member } = await service
    .from('retailer_users')
    .select('profile_id, access_role')
    .eq('id', memberId)
    .eq('retailer_id', retailerId)
    .maybeSingle();

  if (!member) return { error: 'Member not found.' };
  if (member.profile_id === userId) return { error: 'You cannot remove yourself.' };
  if (member.access_role === 'owner' && accessRole !== 'owner') {
    return { error: 'Managers cannot remove owners.' };
  }

  const { error } = await service
    .from('retailer_users')
    .update({ is_active: false })
    .eq('id', memberId)
    .eq('retailer_id', retailerId);

  if (error) {
    console.error('[removeMember] error:', error.message);
    return { error: 'Could not remove member. Please try again.' };
  }

  revalidatePath('/team');
  return { error: null, success: true };
}

export async function acceptTeamInvitation(
  token: string,
  userId: string,
): Promise<{ error: string | null }> {
  // Verify the accepting user's email matches the invitation.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  const service = createServiceClient();

  const { data: invite } = await service
    .from('retailer_invitations')
    .select('id, retailer_id, role, email, status, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (!invite || invite.status !== 'pending' || new Date(invite.expires_at) < new Date()) {
    return { error: 'This invite link has expired or is no longer valid.' };
  }

  if ((user.email ?? '').toLowerCase() !== invite.email.toLowerCase()) {
    return { error: 'This invitation was sent to a different email address.' };
  }

  const { error: linkError } = await service.from('retailer_users').upsert(
    {
      retailer_id: invite.retailer_id,
      profile_id: userId,
      access_role: invite.role,
      is_active: true,
    },
    { onConflict: 'retailer_id,profile_id' },
  );

  if (linkError) {
    console.error('[acceptTeamInvitation] upsert error:', linkError.message);
    return { error: 'Could not link your account. Please try again.' };
  }

  await service
    .from('retailer_invitations')
    .update({ status: 'accepted' })
    .eq('id', invite.id);

  return { error: null };
}
