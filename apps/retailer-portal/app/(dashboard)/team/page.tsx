import type { Metadata } from 'next';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { InviteMemberForm } from '@/components/team/invite_member_form';
import { ChangeRoleSelect } from '@/components/team/change_role_select';
import { RemoveMemberButton } from '@/components/team/remove_member_button';
import { RevokeInviteButton } from '@/components/team/revoke_invite_button';
import { InviteLinkSection } from '@/components/settings/invite_link_section';

export const metadata: Metadata = { title: 'Team – Retailer Portal' };

type MemberRow = {
  id: string;
  access_role: string;
  created_at: string;
  profile_id: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

type PendingInvite = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
};

const ROLE_LABELS: Record<string, { label: string; classes: string }> = {
  owner:        { label: 'Owner',   classes: 'bg-green-100 text-green-800 border-green-200' },
  manager:      { label: 'Manager', classes: 'bg-blue-100 text-blue-800 border-blue-200' },
  staff:        { label: 'Staff',   classes: 'bg-gray-100 text-gray-700 border-gray-200' },
  scanner_only: { label: 'Scanner', classes: 'bg-amber-100 text-amber-800 border-amber-200' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default async function TeamPage() {
  const { retailerId, accessRole, userId } = await requireRetailerUser();
  const canManage = accessRole === 'owner' || accessRole === 'manager';
  const isOwner = accessRole === 'owner';

  const service = createServiceClient();

  const [membersResult, invitesResult, scannerInviteResult] = await Promise.all([
    service
      .from('retailer_users')
      .select('id, access_role, created_at, profile_id, profiles(full_name, email)')
      .eq('retailer_id', retailerId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),

    canManage
      ? service
          .from('retailer_invitations')
          .select('id, email, role, expires_at')
          .eq('retailer_id', retailerId)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),

    canManage
      ? service
          .from('scanner_invites')
          .select('id, token, expires_at')
          .eq('retailer_id', retailerId)
          .eq('is_revoked', false)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const members = (membersResult.data ?? []) as unknown as MemberRow[];
  const pendingInvites = (invitesResult.data ?? []) as unknown as PendingInvite[];
  const activeInvite = scannerInviteResult.data
    ? {
        id: scannerInviteResult.data.id,
        token: scannerInviteResult.data.token,
        expiresAt: scannerInviteResult.data.expires_at,
      }
    : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="text-sm text-gray-500 mt-1">Manage team members and their access levels.</p>
      </div>

      {/* ── Active members ────────────────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">Active members</h2>
          <p className="text-sm text-gray-500 mt-1">People with access to this retailer account.</p>
        </div>

        {members.length > 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name / Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Since</th>
                  {canManage && <th className="px-4 py-3" aria-label="Actions" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((member) => {
                  const badge = ROLE_LABELS[member.access_role] ?? { label: member.access_role, classes: 'bg-gray-100 text-gray-700 border-gray-200' };
                  const isSelf = member.profile_id === userId;
                  const canChangeRole = isOwner && !isSelf && member.access_role !== 'owner';
                  const canRemove = canManage && !isSelf && (member.access_role !== 'owner' || isOwner);

                  return (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">
                          {member.profiles?.full_name ?? '—'}
                          {isSelf && <span className="ml-1.5 text-xs text-gray-400">(you)</span>}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">{member.profiles?.email ?? ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        {canChangeRole ? (
                          <ChangeRoleSelect memberId={member.id} currentRole={member.access_role} />
                        ) : (
                          <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${badge.classes}`}>
                            {badge.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(member.created_at)}</td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          {canRemove && (
                            <RemoveMemberButton
                              memberId={member.id}
                              memberName={member.profiles?.full_name ?? member.profiles?.email ?? 'this member'}
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            No team members yet.
          </div>
        )}
      </section>

      {/* ── Pending invitations ───────────────────────────────────────────── */}
      {canManage && pendingInvites.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">Pending invitations</h2>
            <p className="text-sm text-gray-500 mt-1">Invites that have been sent but not yet accepted.</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Expires</th>
                  <th className="px-4 py-3" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingInvites.map((invite) => {
                  const badge = ROLE_LABELS[invite.role] ?? { label: invite.role, classes: 'bg-gray-100 text-gray-700 border-gray-200' };
                  return (
                    <tr key={invite.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{invite.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(invite.expires_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <RevokeInviteButton inviteId={invite.id} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Invite form ───────────────────────────────────────────────────── */}
      {canManage && (
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">Invite a team member</h2>
          </div>
          <InviteMemberForm accessRole={accessRole} />
        </section>
      )}

      {/* ── Scanner invite link (quick scanner setup) ─────────────────────── */}
      {canManage && (
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">Scanner invite link</h2>
            <p className="text-sm text-gray-500 mt-1">
              Share this link with staff who only need to scan QR codes. No email required.
            </p>
          </div>
          <InviteLinkSection appUrl={appUrl} activeInvite={activeInvite} />
        </section>
      )}
    </div>
  );
}
