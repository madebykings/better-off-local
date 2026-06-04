import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { acceptTeamInvitation } from '@/lib/actions/team';

export default async function RoleInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const service = createServiceClient();

  const { data: invite } = await service
    .from('retailer_invitations')
    .select('id, retailer_id, role, email, status, expires_at, retailers(name)')
    .eq('token', token)
    .maybeSingle();

  const isValid =
    invite &&
    invite.status === 'pending' &&
    new Date(invite.expires_at) >= new Date();

  if (!isValid) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center space-y-3">
        <p className="text-3xl">&#8987;</p>
        <h1 className="text-xl font-semibold text-gray-900">Link expired</h1>
        <p className="text-sm text-gray-500">
          This invite link is no longer valid. Ask your team manager to send a new one.
        </p>
      </div>
    );
  }

  const retailerName =
    Array.isArray(invite.retailers)
      ? (invite.retailers[0]?.name ?? 'your retailer')
      : ((invite.retailers as { name: string } | null)?.name ?? 'your retailer');

  const roleLabel: Record<string, string> = {
    owner: 'Owner',
    manager: 'Manager',
    scanner_only: 'Scanner',
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { error } = await acceptTeamInvitation(token, user.id);
    if (!error) {
      if (invite.role === 'scanner_only') {
        redirect('/scan');
      }
      redirect('/dashboard');
    }

    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center space-y-3">
        <p className="text-3xl">&#10060;</p>
        <h1 className="text-xl font-semibold text-gray-900">Could not accept invite</h1>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-8 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          You&apos;ve been invited to join {retailerName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Role: <span className="font-medium text-gray-700">{roleLabel[invite.role] ?? invite.role}</span>
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Sign in with <span className="font-medium">{invite.email}</span> to accept this invite.
        </p>
      </div>
      <p className="text-xs text-gray-400">
        After signing in, you&apos;ll be redirected automatically.
      </p>
    </div>
  );
}
