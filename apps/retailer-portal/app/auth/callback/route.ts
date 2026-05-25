import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { acceptInvite } from '@/lib/actions/scanner_invites';

/**
 * Handles Supabase auth callbacks — used for staff invite magic links.
 *
 * Flow:
 * 1. Exchange the ?code= param for a session cookie.
 * 2. If an ?invite=TOKEN param is present:
 *    a. If the user has no display name yet → redirect to /invite/[token]/setup
 *    b. Otherwise → accept the invite and redirect to /scan
 * 3. Without an invite param, redirect to ?next= or /scan.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const inviteToken = searchParams.get('invite');
  const next = searchParams.get('next') ?? '/scan';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('Auth callback error:', error.message);
      if (inviteToken) {
        return NextResponse.redirect(
          new URL(`/invite/${inviteToken}?error=invite_expired`, origin),
        );
      }
      return NextResponse.redirect(new URL('/sign-in?error=invite_expired', origin));
    }
  }

  if (inviteToken) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL(`/invite/${inviteToken}`, origin));
    }

    // Check whether the user needs to supply a display name.
    const service = createServiceClient();
    const { data: profile } = await service
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    if (!profile?.full_name) {
      return NextResponse.redirect(
        new URL(`/invite/${inviteToken}/setup`, origin),
      );
    }

    // Has a name — accept and go straight to scanner.
    await acceptInvite(inviteToken, user.id);
    return NextResponse.redirect(new URL('/scan', origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
