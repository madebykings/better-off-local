import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Payment confirmed – Retailer Portal' };

/**
 * Post-checkout landing page.
 *
 * Stripe redirects here after a successful Checkout Session. The webhook
 * (`invoice.paid`) will activate the subscription and set visibility_status=live
 * asynchronously — usually within a few seconds. We show a confirmation and
 * direct the retailer to their dashboard.
 */
export default function BillingSuccessPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <span className="text-2xl">✓</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Payment confirmed</h1>
        <p className="mt-3 text-sm text-gray-500">
          Your subscription is being activated. Your listing will go live within a few seconds
          once we receive confirmation from Stripe.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
          >
            Go to dashboard
          </Link>
          <Link
            href="/billing"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            View billing details
          </Link>
        </div>
      </div>
    </div>
  );
}
