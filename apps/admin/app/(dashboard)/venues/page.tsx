import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader, StatusBadge, EmptyState } from '@better-off-local/ui';

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
      <PageHeader
        title="Venues"
        description="Venue listings — review and moderate what appears in consumer discovery."
      />

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
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-700 w-64"
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No venues found"
          description={activeTab === 'pending' ? 'No venues awaiting review.' : 'Nothing matches your filter.'}
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
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
                  return (
                    <tr key={v.id} className={`hover:bg-gray-50 transition-colors ${!v.is_active ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {v.name ?? v.address_line_1 ?? 'Unnamed venue'}
                          {v.is_primary && (
                            <span className="ml-1.5 rounded border border-green-200 bg-green-50 px-1 py-0.5 text-xs font-medium text-green-700">Primary</span>
                          )}
                          {!v.is_active && (
                            <span className="ml-1.5 rounded border border-gray-300 bg-gray-100 px-1 py-0.5 text-xs font-medium text-gray-500">Inactive</span>
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
                        <StatusBadge status={v.review_status} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={v.billing_status} />
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

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((v) => {
              const retailer = Array.isArray(v.retailers) ? v.retailers[0] : v.retailers;
              const address = [v.address_line_1, v.town, v.postcode].filter(Boolean).join(', ');
              return (
                <div key={v.id} className={`rounded-lg border border-gray-200 bg-white p-4 ${!v.is_active ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {v.name ?? v.address_line_1 ?? 'Unnamed venue'}
                      </p>
                      {address && <p className="text-xs text-gray-400 mt-0.5">{address}</p>}
                      {retailer && (
                        <p className="text-xs text-gray-500 mt-0.5">{retailer.name}</p>
                      )}
                    </div>
                    <Link href={`/venues/${v.id}`} className="shrink-0 text-sm font-medium text-green-700">
                      Review →
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <StatusBadge status={v.review_status} />
                    <StatusBadge status={v.billing_status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{formatDate(v.submitted_at ?? v.updated_at)}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
