import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { acceptInvite } from '@/lib/actions/scanner_invites';
import { DisplayNameForm } from '@/components/invite/display_name_form';

export default async function InviteSetupPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Must be authenticated to reach this page.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/invite/${token}`);
  }

  const service = createServiceClient();

  // Validate token is still active.
  const { data: invite } = await service
    .from('scanner_invites')
    .select('id, retailer_id, expires_at, is_revoked, max_uses, use_count')
    .eq('token', token)
    .maybeSingle();

  const isValid =
    invite &&
    !invite.is_revoked &&
    new Date(invite.expires_at) >= new Date() &&
    (invite.max_uses === null || invite.use_count < invite.max_uses);

  if (!isValid) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center space-y-3">
        <p className="text-3xl">⏱</p>
        <h1 className="text-xl font-semibold text-gray-900">Link expired</h1>
        <p className="text-sm text-gray-500">
          This invite link is no longer valid. Ask your manager to send a new one.
        </p>
      </div>
    );
  }

  // If the user already has a display name, skip straight to accepting.
  const { data: profile } = await service
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  if (profile?.full_name) {
    await acceptInvite(token, user.id);
    redirect('/scan');
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-gray-900">What should we call you?</h1>
        <p className="text-sm text-gray-500">
          This name will appear when you scan customer codes.
        </p>
      </div>

      <DisplayNameForm token={token} />
    </div>
  );
}
