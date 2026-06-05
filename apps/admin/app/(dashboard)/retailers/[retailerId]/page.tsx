import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

const PARTNER_TYPE_OPTIONS = [
  { value: 'business',        label: 'Local business' },
  { value: 'club',            label: 'Sports club' },
  { value: 'charity',         label: 'Charity' },
  { value: 'community_group', label: 'Community group' },
  { value: 'organisation',    label: 'Other organisation' },
];

const PARTNER_TYPE_BADGE: Record<string, string> = {
  business:         'bg-blue-50 text-blue-700 border-blue-200',
  club:             'bg-green-50 text-green-700 border-green-200',
  charity:          'bg-purple-50 text-purple-700 border-purple-200',
  community_group:  'bg-amber-50 text-amber-700 border-amber-200',
  organisation:     'bg-gray-50 text-gray-600 border-gray-200',
};

const PARTNER_TYPE_LABELS: Record<string, string> = {
  business:         'Business',
  club:             'Club',
  charity:          'Charity',
  community_group:  'Community Group',
  organisation:     'Organisation',
};
import {
  updateRetailerDetails,
  setVenueAllowanceOverride,
  deactivateRetailer,
} from '@/lib/actions/admin';
import { RetailerModerationActions } from '@/components/moderation/moderation_actions';
import {
  approveRetailer,
  rejectRetailer,
  suspendRetailer,
  setRetailerVisibility,
} from '@/lib/actions/moderation';

export const metadata: Metadata = { title: 'Retailer – Admin' };

interface Props {
  params: Promise<{ retailerId: string }>;
}

function AccountStatusBadge({ isActive, approvalStatus }: { isActive: boolean; approvalStatus: string }) {
  if (!isActive || approvalStatus === 'suspended') {
    return (
      <span className="inline-flex items-center rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
        {approvalStatus === 'suspended' ? 'Suspended' : 'Inactive'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
      Active
    </span>
  );
}

function VenueReviewBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:    { label: 'Draft',    cls: 'bg-gray-100 text-gray-600 border-gray-200' },
    pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    approved: { label: 'Approved', cls: 'bg-green-100 text-green-700 border-green-200' },
    rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700 border-red-200' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default async function RetailerDetailPage({ params }: Props) {
  await requireAdmin();
  const { retailerId } = await params;
  const supabase = createServiceClient();

  const [
    { data: retailer },
    { data: venues },
    { data: subData },
  ] = await Promise.all([
    supabase
      .from('retailers')
      .select('id, name, slug, tagline, short_description, description, contact_name, phone, email, business_type, partner_type, approval_status, visibility_status, is_active, created_at, updated_at')
      .eq('id', retailerId)
      .single(),
    supabase
      .from('retailer_locations')
      .select('id, name, address_line_1, town, postcode, is_primary, is_active, is_featured, review_status, billing_status')
      .eq('retailer_id', retailerId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('retailer_subscriptions')
      .select('status, current_period_end, extra_venues_quantity, venue_allowance_override')
      .eq('retailer_id', retailerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!retailer) notFound();

  const allVenues   = venues ?? [];
  const activeVenues = allVenues.filter((v) => v.is_active);
  const extraQty    = subData?.extra_venues_quantity ?? 0;
  const computed    = 1 + extraQty;
  const override    = subData?.venue_allowance_override ?? null;
  const allowance   = override ?? computed;

  const subStatus   = subData?.status ?? null;
  const subEnd      = subData?.current_period_end ?? null;

  const BILLING_BADGES: Record<string, string> = {
    free_growth_region: 'bg-blue-50 text-blue-700 border-blue-200',
    paid_required:      'bg-amber-50 text-amber-700 border-amber-200',
    paid:               'bg-green-50 text-green-700 border-green-200',
    admin_waived:       'bg-purple-50 text-purple-700 border-purple-200',
    inactive:           'bg-gray-50 text-gray-500 border-gray-200',
  };

  const BILLING_LABELS: Record<string, string> = {
    free_growth_region: 'Free',
    paid_required:      'Payment req.',
    paid:               'Paid',
    admin_waived:       'Waived',
    inactive:           'Inactive',
  };

  return (
    <div className="max-w-3xl">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/retailers" className="text-sm text-gray-500 hover:text-gray-700">
            ← Retailers
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-semibold">{retailer.name}</h1>
          <AccountStatusBadge isActive={retailer.is_active} approvalStatus={retailer.approval_status} />
          {(() => {
            const pt = (retailer as any).partner_type ?? 'business';
            const cls = PARTNER_TYPE_BADGE[pt] ?? PARTNER_TYPE_BADGE.organisation;
            return (
              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
                {PARTNER_TYPE_LABELS[pt] ?? pt}
              </span>
            );
          })()}
        </div>
      </div>

      {/* ── Subscription summary ────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 mb-6 flex items-center gap-6 text-sm flex-wrap">
        <div>
          <span className="text-xs text-gray-400 block">Subscription</span>
          <span className={`font-medium ${subStatus === 'active' ? 'text-green-700' : 'text-gray-500'}`}>
            {subStatus ? subStatus.replace('_', ' ') : 'None'}
          </span>
        </div>
        {subEnd && (
          <div>
            <span className="text-xs text-gray-400 block">Current period ends</span>
            <span className="font-medium text-gray-700">
              {new Date(subEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        )}
        <div>
          <span className="text-xs text-gray-400 block">Venue allowance</span>
          <span className="font-medium text-gray-700">
            {activeVenues.length} / {allowance} used
          </span>
        </div>
        <div>
          <span className="text-xs text-gray-400 block">Visibility</span>
          <span className="font-medium text-gray-700">{retailer.visibility_status}</span>
        </div>
      </div>

      {/* ── Moderation actions ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Moderation actions</p>
        <RetailerModerationActions
          retailerId={retailerId}
          currentApprovalStatus={retailer.approval_status}
          approveAction={approveRetailer}
          rejectAction={rejectRetailer}
          suspendAction={suspendRetailer}
          setVisibilityAction={setRetailerVisibility}
        />
      </div>

      {/* ── Account activation ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-2">Account activation</p>
        <form action={deactivateRetailer} className="flex items-center gap-3">
          <input type="hidden" name="id" value={retailerId} />
          <input type="hidden" name="is_active" value={String(retailer.is_active)} />
          <button
            type="submit"
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              retailer.is_active
                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
            }`}
          >
            {retailer.is_active ? 'Deactivate account' : 'Reactivate account'}
          </button>
          <span className="text-xs text-gray-400">
            {retailer.is_active
              ? 'Hides all venues and prevents login to the portal.'
              : 'Reactivates the account and restores portal access.'}
          </span>
        </form>
      </div>

      {/* ── Venues ──────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Venues ({allVenues.length})
          </h2>
          <Link href={`/venues?q=${encodeURIComponent(retailer.name)}`} className="text-xs text-green-700 hover:text-green-900">
            View in Venues ↗
          </Link>
        </div>

        {allVenues.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-400">No venues yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {allVenues.map((v) => {
              const billingCls = BILLING_BADGES[v.billing_status as string] ?? BILLING_BADGES.inactive;
              const billingLabel = BILLING_LABELS[v.billing_status as string] ?? (v.billing_status as string).replace(/_/g, ' ');
              const address = [v.address_line_1, v.town, v.postcode].filter(Boolean).join(', ');
              return (
                <div key={v.id} className={`flex items-center justify-between px-4 py-3 gap-4 ${!v.is_active ? 'opacity-60' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {v.name ?? v.address_line_1 ?? 'Unnamed'}
                      </span>
                      {v.is_primary && (
                        <span className="shrink-0 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">Primary</span>
                      )}
                      {!v.is_active && (
                        <span className="shrink-0 rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
                      )}
                      <VenueReviewBadge status={v.review_status ?? 'draft'} />
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium ${billingCls}`}>
                        {billingLabel}
                      </span>
                    </div>
                    {address && <p className="text-xs text-gray-400 mt-0.5 truncate">{address}</p>}
                  </div>
                  <Link
                    href={`/venues/${v.id}`}
                    className="shrink-0 text-xs font-medium text-green-700 hover:text-green-900"
                  >
                    Manage →
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Allowance override */}
        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">
            Venue allowance: {activeVenues.length} active · {allowance} allowed (base 1 + {extraQty} purchased{override !== null ? ` · override: ${override}` : ''})
          </p>
          <form action={setVenueAllowanceOverride} className="flex items-center gap-3 flex-wrap">
            <input type="hidden" name="retailer_id" value={retailerId} />
            <input
              type="number"
              name="override"
              min={1}
              defaultValue={override ?? ''}
              placeholder={`Computed: ${computed}`}
              className="w-28 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-green-700"
            />
            <button
              type="submit"
              className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
            >
              Set override
            </button>
            {override !== null && (
              <form action={setVenueAllowanceOverride}>
                <input type="hidden" name="retailer_id" value={retailerId} />
                <input type="hidden" name="override" value="" />
                <button type="submit" className="text-sm text-gray-400 hover:text-gray-600">
                  Clear
                </button>
              </form>
            )}
          </form>
        </div>
      </div>

      {/* ── Edit account details ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Account details</h2>
        </div>
        <form action={updateRetailerDetails} className="p-4 space-y-4">
          <input type="hidden" name="retailer_id" value={retailerId} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Business name</label>
              <input
                type="text"
                name="name"
                defaultValue={retailer.name ?? ''}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tagline</label>
              <input
                type="text"
                name="tagline"
                defaultValue={(retailer as any).tagline ?? ''}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Short description</label>
            <textarea
              name="short_description"
              defaultValue={(retailer as any).short_description ?? ''}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700 resize-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Owner / contact name</label>
              <input
                type="text"
                name="contact_name"
                defaultValue={(retailer as any).contact_name ?? ''}
                placeholder="e.g. Jane Smith"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Owner / contact phone</label>
              <input
                type="text"
                name="phone"
                defaultValue={(retailer as any).phone ?? ''}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Owner / contact email</label>
              <input
                type="email"
                name="email"
                defaultValue={(retailer as any).email ?? ''}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Business type</label>
              <input
                type="text"
                name="business_type"
                defaultValue={(retailer as any).business_type ?? ''}
                placeholder="e.g. Food & Drink"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Partner type</label>
              <select
                name="partner_type"
                defaultValue={(retailer as any).partner_type ?? 'business'}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700 bg-white"
              >
                {PARTNER_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <button
              type="submit"
              className="rounded-lg bg-green-800 px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
