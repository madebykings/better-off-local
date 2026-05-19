import Link from 'next/link';
import { OnboardingProgress } from '@/components/onboarding/onboarding_progress';
import { OnboardingNav } from '@/components/onboarding/onboarding_nav';

/**
 * Isolated layout for the retailer onboarding flow.
 *
 * Deliberately has no sidebar, no dashboard header, and no bottom nav.
 * The only persistent chrome is the minimal top bar, the step progress
 * indicator, and the back/continue footer.
 *
 * Retailers arrive here immediately after sign-up and are redirected back
 * here from the dashboard if their onboarding is incomplete.
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <span className="text-lg font-semibold text-brand">
          Better Off Local
        </span>

        {/*
          Save and exit persists progress and returns to the dashboard stub.
          The retailer can resume from where they left off.
          TODO: wire up save-progress server action before navigation.
        */}
        <Link
          href="/dashboard"
          className="text-sm text-gray-400 transition-colors hover:text-gray-600"
        >
          Save and exit
        </Link>
      </header>

      {/* ── Step progress bar ────────────────────────────────────────────── */}
      <OnboardingProgress />

      {/* ── Step content ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-6 py-10">{children}</main>

      {/* ── Back / Continue footer ───────────────────────────────────────── */}
      <OnboardingNav />
    </div>
  );
}
