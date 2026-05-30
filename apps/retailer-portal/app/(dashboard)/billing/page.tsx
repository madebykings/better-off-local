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
  active:    { label: 'Active',           classes: 'bg-green-100 text-green-800 border-green-200' },
  inactive:  { label: 'Not started',      classes: 'bg-gray-100 text-gray-600 border-gray-200' },
  past_due:  { label: 'Payment overdue',  classes: 'bg-amber-100 text-amber-800 border-amber-200' },
  cancelled: { label: 'Cancelled',        classes: 'bg-red-100 text-red-800 border-red-200' },
  expired:   { label: 'Expired',          classes: 'bg-red-100 text-red-800 border-red-200' },
};

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  const cls = pct >= 100 ? 'bg-green-600' : pct >= 60 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-500 shrink-0">{value} / {max}</span>
    </div>
  );
}

export default async function BillingPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const [{ data: retailer }, { data: subscription }, { data: primaryVenue }] = await Promise.all([
    supabase.from('retailers').select('approval_status').eq('id', retailerId).single(),
    supabase
      .from('retailer_subscriptions')
      .select('status, current_period_start, current_period_end, cancel_at_period_end, started_at')
      .eq('retailer_id', retailerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('retailer_locations')
      .select('id, region_id, billing_status, grace_period_ends_at')
      .eq('retailer_id', retailerId)
      .eq('is_primary', true)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  const isApproved   = retailer?.approval_status === 'approved';
  const subStatus    = subscription?.status ?? null;
  const isActive     = subStatus === 'active';
  const isPastDue    = subStatus === 'past_due';
  const isCancelled  = subStatus === 'cancelled' || subStatus === 'expired';
  const statusBadge  = subStatus ? STATUS_COPY[subStatus] : null;

  const billingStatus = primaryVenue?.billing_status ?? null;
  const isGrowthRegion = billingStatus === 'free_growth_region';
  const isAdminWaived  = billingStatus === 'admin_waived';
  const inGrace = billingStatus === 'paid_required' && primaryVenue?.grace_period_ends_at
    ? new Date(primaryVenue.grace_period_ends_at) > new Date()
    : false;
  const graceDays = inGrace && primaryVenue?.grace_period_ends_at
    ? Math.ceil((new Date(primaryVenue.grace_period_ends_at).getTime() - Date.now()) / 86_400_000)
    : 0;

  // Fetch region stats if a region is assigned.
  let regionName: string | null = null;
  let activeCount = 0;
  let payingCount = 0;
  let memberThreshold = 100;

  if (primaryVenue?.region_id) {
    const [{ data: region }, { data: aCount }, { data: pCount }] = await Promise.all([
      supabase.from('regions').select('name, member_threshold').eq('id', primaryVenue.region_id).maybeSingle(),
      supabase.rpc('region_active_member_count', { p_region_id: primaryVenue.region_id }),
      supabase.rpc('region_paying_member_count', { p_region_id: primaryVenue.region_id }),
    ]);
    regionName = region?.name ?? null;
    memberThreshold = region?.member_threshold ?? 100;
    activeCount = (aCount as number | null) ?? 0;
    payingCount = (pCount as number | null) ?? 0;
  }

  const needsActivation = isApproved && (!subStatus || subStatus === 'inactive' || isCancelled);

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Your subscription and regional billing status.</p>
      </div>

      {/* Not approved */}
      {!isApproved && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-600">
            Your listing must be approved by our team before you can activate a subscription.
            We will email you once your review is complete.
          </p>
        </div>
      )}

      {/* Growth region — listed for free */}
      {isApproved && isGrowthRegion && !isActive && (
        <div className="rounded-lg border border-green-200 bg-white p-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🌱</span>
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                You&apos;re listed for free
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Better Off Local is building member demand in your area.
                You won&apos;t be charged until{regionName ? ` ${regionName}` : ' your area'} reaches {memberThreshold} active members.
              </p>
            </div>
          </div>

          {primaryVenue?.region_id && (
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              {regionName && (
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  {regionName}
                </p>
              )}
              <p className="text-sm text-gray-700">
                <span className="font-semibold tabular-nums">{activeCount}</span> active member{activeCount !== 1 ? 's' : ''}{' '}
                <span className="text-gray-400">({payingCount} paying)</span>
              </p>
              <ProgressBar value={activeCount} max={memberThreshold} />
              <p className="text-xs text-gray-400 mt-2">
                When this area reaches {memberThreshold} members, you&apos;ll have 30 days
                to activate your subscription before your listing is paused.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Admin waived */}
      {isApproved && isAdminWaived && (
        <div className="rounded-lg border border-purple-200 bg-white p-5">
          <p className="text-sm font-medium text-purple-800">Subscription waived</p>
          <p className="text-sm text-gray-500 mt-1">
            Your subscription has been waived by Better Off Local. Your listing is active.
          </p>
        </div>
      )}

      {/* Within grace period */}
      {isApproved && inGrace && !isActive && (
        <div className="rounded-lg border border-amber-200 bg-white p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Subscription required</h2>
            <p className="text-sm text-gray-500 mt-1">
              {regionName ? `${regionName} has` : 'Your area has'} reached {memberThreshold} active members.
              You have <strong>{graceDays} day{graceDays !== 1 ? 's' : ''}</strong> remaining to activate
              your subscription before your listing is paused.
            </p>
          </div>
          <div className="rounded-md border border-gray-100 bg-gray-50 p-4 text-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">Annual retailer listing</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  Unlimited offers · Member discounts · Dashboard analytics
                </p>
              </div>
              <span className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-600">£49.99/yr</span>
            </div>
          </div>
          <CheckoutButton label="Activate listing" hint="Secure checkout via Stripe" />
        </div>
      )}

      {/* Needs activation (threshold met, no grace, no sub) */}
      {isApproved && needsActivation && !isGrowthRegion && !isAdminWaived && !inGrace && (
        <div className="rounded-lg border border-green-200 bg-white p-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">
            {isCancelled ? 'Reactivate your listing' : 'Activate your listing'}
          </h2>
          <p className="text-sm text-gray-500">
            {isCancelled
              ? 'Your subscription ended. Resubscribe to go live again.'
              : 'Subscribe to an annual plan to go live and start reaching members.'}
          </p>
          <div className="rounded-md border border-gray-100 bg-gray-50 p-4 text-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">Annual retailer listing</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  Unlimited offers · Member discounts · Dashboard analytics
                </p>
              </div>
              <span className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-600">£49.99/yr</span>
            </div>
          </div>
          <CheckoutButton
            label={isCancelled ? 'Reactivate listing' : 'Activate listing'}
            hint="Secure checkout via Stripe · Cancel anytime"
          />
        </div>
      )}

      {/* Active or past due */}
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
