import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Venues – Admin' };

interface Props {
  searchParams: Promise<{ tab?: string; q?: string }>;
}

const TABS = [
  { id: 'pending',  label: 'Pending review' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'approved', label: 'Approved' },
  { id: 'all',      label: 'All' },
] as const;

const REVIEW_BADGES: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-600 border-gray-200',
  pending:  'bg-yellow-100 text-yellow-800 border-yellow-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

const BILLING_BADGES: Record<string, string> = {
  free_growth_region: 'bg-blue-50 text-blue-700 border-blue-200',
  paid_required:      'bg-amber-50 text-amber-700 border-amber-200',
  paid:               'bg-green-50 text-green-700 border-green-200',
  admin_waived:       'bg-purple-50 text-purple-700 border-purple-200',
  inactive:           'bg-gray-50 text-gray-500 border-gray-200',
};

const BILLING_LABELS: Record<string, string> = {
  free_growth_region: 'Free',
  paid_required:      'Payment required',
  paid:               'Paid',
  admin_waived:       'Waived',
  inactive:           'Inactive',
};

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function VenuesPage({ searchParams }: Props) {
  await requireAdmin();
  const { tab, q } = await searchParams;
  const activeTab = tab ?? 'pending';
  const supabase = createServiceClient();

  let query = supabase
    .from('retailer_locations')
    .select('id, name, address_line_1, town, postcode, is_primary, is_active, is_featured, review_status, billing_status, submitted_at, updated_at, retailer_id, retailers(id, name)')
    .order('submitted_at', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false });

  if (activeTab === 'pending') {
    query = query.eq('review_status', 'pending');
  } else if (activeTab === 'rejected') {
    query = query.eq('review_status', 'rejected');
  } else if (activeTab === 'approved') {
    query = query.eq('review_status', 'approved');
  } else {
    query = query.neq('review_status', 'draft');
  }

  const { data: venues } = await query;

  let rows = (venues ?? []) as Array<{
    id: string;
    name: string | null;
    address_line_1: string | null;
    town: string | null;
    postcode: string | null;
    is_primary: boolean;
    is_active: boolean;
    is_featured: boolean;
    review_status: string;
    billing_status: string;
    submitted_at: string | null;
    updated_at: string | null;
    retailer_id: string;
    retailers: { id: string; name: string } | { id: string; name: string }[] | null;
  }>;

  if (q) {
    const lower = q.toLowerCase();
    rows = rows.filter((v) => {
      const venueName = (v.name ?? '').toLowerCase();
      const retailer = Array.isArray(v.retailers) ? v.retailers[0] : v.retailers;
      const retailerName = (retailer?.name ?? '').toLowerCase();
      const addr = (v.address_line_1 ?? '').toLowerCase();
      return venueName.includes(lower) || retailerName.includes(lower) || addr.includes(lower);
    });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Venues</h1>
        <p className="mt-1 text-sm text-gray-500">
          Venue listings — review and moderate what appears in consumer discovery.
        </p>
      </div>

      {/* Tabs + search */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={`/venues${t.id === 'pending' ? '' : `?tab=${t.id}`}${q ? `${t.id === 'pending' ? '?' : '&'}q=${encodeURIComponent(q)}` : ''}`}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form method="GET">
          {tab && <input type="hidden" name="tab" value={tab} />}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search venue, retailer, address…"
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-600 w-64"
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 py-20 text-center">
          <p className="text-3xl">📍</p>
          <p className="mt-3 font-medium text-gray-600">No venues found</p>
          <p className="mt-1 text-sm text-gray-400">
            {activeTab === 'pending' ? 'No venues awaiting review.' : 'Nothing matches your filter.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Venue</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Retailer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Billing</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((v) => {
                const retailer = Array.isArray(v.retailers) ? v.retailers[0] : v.retailers;
                const address = [v.address_line_1, v.town, v.postcode].filter(Boolean).join(', ');
                const reviewCls = REVIEW_BADGES[v.review_status] ?? REVIEW_BADGES.draft;
                const billingCls = BILLING_BADGES[v.billing_status] ?? BILLING_BADGES.inactive;
                const billingLabel = BILLING_LABELS[v.billing_status] ?? v.billing_status.replace(/_/g, ' ');
                return (
                  <tr key={v.id} className={`hover:bg-gray-50 transition-colors ${!v.is_active ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {v.name ?? v.address_line_1 ?? 'Unnamed venue'}
                        {v.is_primary && (
                          <span className="ml-1.5 rounded border border-green-200 bg-green-50 px-1 py-0.5 text-[10px] font-medium text-green-700">Primary</span>
                        )}
                        {!v.is_active && (
                          <span className="ml-1.5 rounded border border-gray-300 bg-gray-100 px-1 py-0.5 text-[10px] font-medium text-gray-500">Inactive</span>
                        )}
                      </div>
                      {address && <div className="text-xs text-gray-400 mt-0.5">{address}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {retailer ? (
                        <Link href={`/retailers/${retailer.id}`} className="text-green-700 hover:text-green-900 font-medium">
                          {retailer.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${reviewCls}`}>
                        {v.review_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${billingCls}`}>
                        {billingLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(v.submitted_at ?? v.updated_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/venues/${v.id}`}
                        className="font-medium text-green-700 hover:text-green-900"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
