import Link from 'next/link';
import {
  requireOnboardingRetailer,
  guardOnboardingStep,
} from '@/lib/auth/require_onboarding_retailer';

/**
 * Confirmation screen shown after the retailer submits for review.
 *
 * This is a terminal step — no back/continue footer is shown (OnboardingNav
 * returns null for the 'submitted' step id).
 *
 * What happens next (for the retailer's awareness):
 *   1. Admin reviews the listing in the admin portal
 *   2. Retailer receives an approval or change-request email
 *   3. On approval: portal shows "Activate your listing" — plan selection + Stripe
 *   4. Successful payment sets the retailer live
 */
export default async function SubmittedPage() {
  const { retailer } = await requireOnboardingRetailer();
  guardOnboardingStep('submitted', retailer?.onboarding_step ?? null);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center py-16 text-center">
      {/* Success icon */}
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
        <svg
          className="h-8 w-8 text-brand"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
        You're submitted!
      </h1>

      <p className="mt-3 text-[15px] leading-relaxed text-gray-500">
        We'll review your listing and get back to you by email — usually within
        1–2 business days.
      </p>

      {/* What happens next */}
      <div className="mt-10 w-full rounded-xl border border-gray-100 bg-gray-50 px-6 py-6 text-left">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
          What happens next
        </h2>
        <ol className="space-y-4">
          {[
            {
              step: '1',
              title: 'We review your listing',
              body: 'Our team checks your business details, branding, and offer.',
            },
            {
              step: '2',
              title: 'You receive an email',
              body: 'Approved, or we'll ask for changes. Usually within 1–2 days.',
            },
            {
              step: '3',
              title: 'Activate your listing',
              body: 'Choose a plan and pay. Your listing goes live immediately.',
            },
          ].map(({ step, title, body }) => (
            <li key={step} className="flex gap-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {step}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-900">{title}</p>
                <p className="mt-0.5 text-sm text-gray-500">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <Link
        href="/dashboard"
        className="mt-10 rounded-lg bg-brand px-8 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
