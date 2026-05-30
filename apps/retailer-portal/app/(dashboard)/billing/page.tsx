import type { Metadata } from 'next';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { CheckoutButton } from '@/components/dashboard/checkout_button';
import { ManageSubscriptionButton } from '@/components/dashboard/manage_subscription_button';

export const metadata: Metadata = { title: 'Billing – Retailer Portal' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

const STATUS_COPY: Record<string, { label: string; classes: string }> = {
  active:    { label: 'Active',      classes: 'bg-green-100 text-green-800 border-green-200' },
  inactive:  { label: 'Not started', classes: 'bg-gray-100 text-gray-600 border-gray-200' },
  past_due:  { label: 'Payment overdue', classes: 'bg-amber-100 text-amber-800 border-amber-200' },
  cancelled: { label: 'Cancelled',   classes: 'bg-red-100 text-red-800 border-red-200' },
  expired:   { label: 'Expired',     classes: 'bg-red-100 text-red-800 border-red-200' },
};

export default async function BillingPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const [{ data: retailer }, { data: subscription }] = await Promise.all([
    supabase
      .from('retailers')
      .select('approval_status')
      .eq('id', retailerId)
      .single(),
    supabase
      .from('retailer_subscriptions')
      .select('status, current_period_start, current_period_end, cancel_at_period_end, started_at')
      .eq('retailer_id', retailerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const isApproved = retailer?.approval_status === 'approved';
  const subStatus  = subscription?.status ?? null;
  const isActive   = subStatus === 'active';
  const isPastDue  = subStatus === 'past_due';
  const isCancelled = subStatus === 'cancelled' || subStatus === 'expired';
  const needsActivation = isApproved && (!subStatus || subStatus === 'inactive' || isCancelled);
  const statusBadge = subStatus ? STATUS_COPY[subStatus] : null;

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your retailer subscription.</p>
      </div>

      {/* Not approved yet */}
      {!isApproved && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">
            Your listing must be approved by our team before you can activate a subscription.
            We will email you once your review is complete.
          </p>
        </div>
      )}

      {/* Approved, needs activation */}
      {needsActivation && (
        <div className="rounded-lg border border-green-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-1">
            {isCancelled ? 'Reactivate your listing' : 'Activate your listing'}
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            Your listing has been approved. Subscribe to an annual plan to go live and start
            reaching members.
          </p>

          <div className="rounded-md border border-gray-100 bg-gray-50 p-4 mb-5 text-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">Annual retailer listing</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  Unlimited offers · Member discounts · Dashboard analytics
                </p>
              </div>
              <span className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                Annual
              </span>
            </div>
          </div>

          <CheckoutButton
            label={isCancelled ? 'Reactivate listing' : 'Activate listing'}
            hint="Secure checkout via Stripe · Cancel anytime"
          />
        </div>
      )}

      {/* Active or past due subscription */}
      {(isActive || isPastDue) && subscription && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Annual retailer listing</h2>
            {statusBadge && (
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${statusBadge.classes}`}>
                {statusBadge.label}
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            {subscription.started_at && (
              <>
                <dt className="text-gray-500">Started</dt>
                <dd className="font-medium text-gray-800">{formatDate(subscription.started_at)}</dd>
              </>
            )}
            {subscription.current_period_end && (
              <>
                <dt className="text-gray-500">
                  {subscription.cancel_at_period_end ? 'Ends' : 'Renews'}
                </dt>
                <dd className="font-medium text-gray-800">
                  {formatDate(subscription.current_period_end)}
                </dd>
              </>
            )}
          </dl>

          {isPastDue && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
              <strong>Payment overdue.</strong> Your listing remains visible while we retry your
              payment. Please update your payment method to avoid interruption.
            </div>
          )}

          {subscription.cancel_at_period_end && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              Your subscription will not renew. Your listing will be hidden after the period ends.
            </div>
          )}

          <ManageSubscriptionButton />
        </div>
      )}
    </div>
  );
}
