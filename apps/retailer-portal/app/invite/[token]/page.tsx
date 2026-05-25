import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { acceptInvite } from '@/lib/actions/scanner_invites';
import { MagicLinkForm } from '@/components/invite/magic_link_form';

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error: errorParam } = await searchParams;

  const service = createServiceClient();

  // Validate the invite token server-side.
  const { data: invite } = await service
    .from('scanner_invites')
    .select('id, retailer_id, expires_at, is_revoked, max_uses, use_count, retailers(name)')
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

  const retailerName =
    Array.isArray(invite.retailers)
      ? (invite.retailers[0]?.name ?? 'your retailer')
      : ((invite.retailers as { name: string } | null)?.name ?? 'your retailer');

  // Check if the user is already authenticated.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Already linked to this retailer — send straight to scanner.
    const { data: existing } = await service
      .from('retailer_users')
      .select('id')
      .eq('profile_id', user.id)
      .eq('retailer_id', invite.retailer_id)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      redirect('/scan');
    }

    // Linked elsewhere or no link yet — check for display name.
    const { data: profile } = await service
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    if (!profile?.full_name) {
      redirect(`/invite/${token}/setup`);
    }

    // Has a name — accept and go.
    await acceptInvite(token, user.id);
    redirect('/scan');
  }

  // Unauthenticated — show magic link form.
  return (
    <div className="bg-white rounded-xl shadow-sm p-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-gray-900">
          Join {retailerName} as a scanner
        </h1>
        <p className="text-sm text-gray-500">
          Enter your email to get a sign-in link. You&apos;ll only be able to
          scan customer codes — no access to the dashboard.
        </p>
      </div>

      {errorParam === 'invite_expired' && (
        <div
          role="alert"
          className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700"
        >
          Your sign-in link expired. Enter your email to get a new one.
        </div>
      )}

      <MagicLinkForm token={token} />
    </div>
  );
}
