import type { Metadata } from 'next';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { RemoveStaffButton } from '@/components/settings/remove_staff_button';
import { InviteLinkSection } from '@/components/settings/invite_link_section';

export const metadata: Metadata = { title: 'Settings – Retailer Portal' };

type StaffRow = {
  id: string;
  access_role: string;
  is_active: boolean;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
  scanner_only: 'Scanner',
};

export default async function SettingsPage() {
  const { retailerId, accessRole } = await requireRetailerUser();
  const canManageStaff = accessRole !== 'scanner_only' && accessRole !== 'staff';

  const service = createServiceClient();

  const [staffResult, inviteResult] = await Promise.all([
    service
      .from('retailer_users')
      .select('id, access_role, is_active, created_at, profiles(full_name, email)')
      .eq('retailer_id', retailerId)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),

    canManageStaff
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

  const staff = (staffResult.data ?? []) as StaffRow[];
  const activeInvite = inviteResult.data
    ? {
        id: inviteResult.data.id,
        token: inviteResult.data.token,
        expiresAt: inviteResult.data.expires_at,
      }
    : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your team and account.</p>
      </div>

      {/* ── Staff management ─────────────────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-gray-900">Staff access</h2>
          <p className="text-sm text-gray-500 mt-1">
            Invite staff to scan member QR codes from their own phone. Scanner
            accounts have no access to the dashboard.
          </p>
        </div>

        {/* Staff list */}
        {staff.length > 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Name / Email
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Role
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Added
                  </th>
                  {canManageStaff && (
                    <th className="px-4 py-3" aria-label="Actions" />
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staff.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">
                        {member.profiles?.full_name ?? '—'}
                      </p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {member.profiles?.email ?? ''}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {ROLE_LABELS[member.access_role] ?? member.access_role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(member.created_at)}
                    </td>
                    {canManageStaff && (
                      <td className="px-4 py-3 text-right">
                        {member.access_role === 'scanner_only' && (
                          <RemoveStaffButton staffId={member.id} />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 mb-4">
            No staff added yet.
          </div>
        )}

        {/* Invite link — owners and managers only */}
        {canManageStaff && (
          <InviteLinkSection appUrl={appUrl} activeInvite={activeInvite} />
        )}
      </section>
    </div>
  );
}
