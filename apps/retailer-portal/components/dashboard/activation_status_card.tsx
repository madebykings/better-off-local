import Link from 'next/link';
import { CheckoutButton } from './checkout_button';

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'changes_requested';
type SubStatus = 'inactive' | 'active' | 'past_due' | 'cancelled' | 'expired' | null;

interface Props {
  approvalStatus: ApprovalStatus;
  subscriptionStatus: SubStatus;
  visibilityStatus: string;
  periodEnd: string | null;
  billingStatus: string | null;
  reviewNotes: string | null;
  liveOfferCount: number;
}

// ── Collapsed view (listing is live) ────────────────────────────────────────

function LiveBanner({ liveOfferCount }: { liveOfferCount: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-white text-sm">
          ✓
        </span>
        <div>
          <p className="text-sm font-semibold text-green-800">Your listing is live</p>
          <p className="text-xs text-green-600">Members can discover and save your offers.</p>
        </div>
      </div>

      {/* Next-step prompts post-activation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/offers/new"
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-green-300 hover:bg-green-50 transition-colors"
        >
          <span className="text-xl">🏷️</span>
          <div>
            <p className="text-sm font-medium text-gray-800">
              {liveOfferCount === 0 ? 'Create your first offer' : 'Add another offer'}
            </p>
            <p className="text-xs text-gray-400">
              {liveOfferCount === 0 ? 'Members need a reason to visit' : `${liveOfferCount} offer${liveOfferCount === 1 ? '' : 's'} live`}
            </p>
          </div>
        </Link>
        <Link
          href="/profile"
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-green-300 hover:bg-green-50 transition-colors"
        >
          <span className="text-xl">✏️</span>
          <div>
            <p className="text-sm font-medium text-gray-800">Edit your profile</p>
            <p className="text-xs text-gray-400">Photos, hours, contact info</p>
          </div>
        </Link>
        <Link
          href="/scan"
          className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-green-300 hover:bg-green-50 transition-colors"
        >
          <span className="text-xl">📷</span>
          <div>
            <p className="text-sm font-medium text-gray-800">Scan a member</p>
            <p className="text-xs text-gray-400">Validate membership QR codes</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

function Step({
  number,
  label,
  done,
  active,
}: {
  number: number;
  label: string;
  done: boolean;
  active: boolean;
}) {
  const bg = done
    ? 'bg-green-500 text-white'
    : active
      ? 'bg-green-100 text-green-700 ring-2 ring-green-400'
      : 'bg-gray-100 text-gray-400';

  return (
    <div className={`flex items-center gap-2 ${active ? 'font-medium text-gray-900' : done ? 'text-gray-700' : 'text-gray-400'}`}>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${bg}`}>
        {done ? '✓' : number}
      </span>
      <span className="text-sm">{label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ActivationStatusCard({
  approvalStatus,
  subscriptionStatus,
  visibilityStatus,
  periodEnd,
  billingStatus,
  reviewNotes,
  liveOfferCount,
}: Props) {
  const isApproved  = approvalStatus === 'approved';
  const isActive    = subscriptionStatus === 'active';
  const isPastDue   = subscriptionStatus === 'past_due';
  const isCancelled = subscriptionStatus === 'cancelled' || subscriptionStatus === 'expired';
  const isLive      = visibilityStatus === 'live';
  const isRejected  = approvalStatus === 'rejected';
  const isSuspended = approvalStatus === 'suspended';
  const isChangesRequested = approvalStatus === 'changes_requested';
  const isGrowthRegion = billingStatus === 'free_growth_region' || billingStatus === 'admin_waived';

  // For growth-region approved retailers: they're listed for free and visible (isLive),
  // but have no Stripe subscription. Treat as "live" if visibility is live.
  if (isApproved && isLive && (isGrowthRegion || isActive)) {
    return <LiveBanner liveOfferCount={liveOfferCount} />;
  }

  const step1Done   = isApproved;
  const step2Done   = isActive || isGrowthRegion;
  const step3Done   = isLive;
  const step1Active = !isApproved && !isRejected && !isSuspended && !isChangesRequested;
  const step2Active = isApproved && !isActive && !isGrowthRegion;
  const step3Active = isApproved && (isActive || isGrowthRegion) && !isLive;

  let statusNote: React.ReactNode = null;

  if (isChangesRequested) {
    statusNote = (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 space-y-2">
        <p className="text-xs font-semibold text-amber-800">Changes requested by our team</p>
        {reviewNotes ? (
          <p className="text-xs text-amber-700">{reviewNotes}</p>
        ) : (
          <p className="text-xs text-amber-700">
            Please check your email for feedback. Once updated, re-submit your listing from your profile.
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <Link
            href="/profile"
            className="rounded bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800 transition-colors"
          >
            Edit profile →
          </Link>
          <Link
            href="/offers"
            className="rounded border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
          >
            Review offers
          </Link>
        </div>
      </div>
    );
  } else if (isRejected) {
    statusNote = (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        Your application was not approved. Please check your email for details or contact support.
      </div>
    );
  } else if (isSuspended) {
    statusNote = (
      <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        Your account has been suspended. Please contact us to resolve this.
      </div>
    );
  } else if (isPastDue) {
    statusNote = (
      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        <strong>Payment overdue.</strong> Your listing remains live while we retry your payment.
        {periodEnd && (
          <> Please update your payment method before{' '}
            {new Date(periodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
          </>
        )}
      </div>
    );
  } else if (isCancelled) {
    statusNote = (
      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        Your subscription has ended and your listing is no longer visible to members.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-700">Getting started</h2>

      <div className="space-y-3 mb-4">
        <Step number={1} label="Approved by our team" done={step1Done} active={step1Active} />
        <Step
          number={2}
          label={isGrowthRegion ? 'Listed for free — growth region' : 'Activate your subscription'}
          done={step2Done}
          active={step2Active}
        />
        <Step number={3} label="Go live" done={step3Done} active={step3Active} />
      </div>

      {statusNote}

      {/* CTA: Activate */}
      {step2Active && !isCancelled && !isGrowthRegion && (
        <div className="mt-4">
          <CheckoutButton
            label="Activate your listing"
            hint="Annual plan · renews automatically"
          />
        </div>
      )}

      {/* CTA: Reactivate after cancellation */}
      {isCancelled && isApproved && (
        <div className="mt-4">
          <CheckoutButton label="Reactivate listing" variant="outline" />
        </div>
      )}

      {/* Pending message */}
      {step1Active && (
        <p className="mt-3 text-xs text-gray-400">
          We review all listings within 2 business days. You'll receive an email with the outcome.
        </p>
      )}
    </div>
  );
}
