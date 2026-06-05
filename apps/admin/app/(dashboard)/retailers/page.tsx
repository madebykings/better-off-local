import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { createRetailer, deactivateRetailer } from '@/lib/actions/admin';
import { PageHeader, StatusBadge, SectionCard, EmptyState } from '@better-off-local/ui';

export const metadata: Metadata = { title: 'Retailers – Admin' };

interface Props {
  searchParams: Promise<{ status?: string; q?: string; activation?: string }>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type SubRow = { retailer_id: string; status: string; current_period_end: string | null };

export default async function RetailersPage({ searchParams }: Props) {
  await requireAdmin();
  const { status, q, activation } = await searchParams;
  const supabase = createServiceClient();

  const { data: categoryOptions } = await supabase
    .from('categories')
    .select('id, name')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');

  let query = supabase
    .from('retailers')
    .select('id, name, slug, approval_status, visibility_status, is_active, created_at')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('approval_status', status);

  const { data: retailers } = await query;

  // Fetch latest subscription per retailer in one query.
  const retailerIds = (retailers ?? []).map((r) => r.id);
  let subsByRetailerId: Record<string, SubRow> = {};

  if (retailerIds.length > 0) {
    const { data: subs } = await supabase
      .from('retailer_subscriptions')
      .select('retailer_id, status, current_period_end')
      .in('retailer_id', retailerIds)
      .order('created_at', { ascending: false });

    // Keep only the most recent subscription per retailer.
    for (const sub of subs ?? []) {
      if (!subsByRetailerId[sub.retailer_id]) {
        subsByRetailerId[sub.retailer_id] = sub as SubRow;
      }
    }
  }

  let filtered = (retailers ?? []).filter((r) =>
    q ? r.name.toLowerCase().includes(q.toLowerCase()) : true,
  );

  // "Not activated" filter: approved but no active subscription.
  if (activation === 'not_activated') {
    filtered = filtered.filter((r) => {
      if (r.approval_status !== 'approved') return false;
      const sub = subsByRetailerId[r.id];
      return !sub || sub.status !== 'active';
    });
  }

  const tabs = ['all', 'pending', 'approved', 'rejected', 'suspended'];

  return (
    <div>
      <PageHeader
        title="Retailers"
        description="Review, approve, and manage all retailers on the platform."
      />

      <SectionCard title="Add retailer">
        <form action={createRetailer} className="flex items-end gap-3 flex-wrap">
          <div>
            <label htmlFor="r-name" className="block text-xs text-gray-500 mb-1">Business name *</label>
            <input
              id="r-name"
              name="name"
              type="text"
              placeholder="e.g. The Coffee Spot"
              required
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700 w-56"
            />
          </div>
          <div>
            <label htmlFor="r-type" className="block text-xs text-gray-500 mb-1">Business type</label>
            <select
              id="r-type"
              name="business_type"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700 w-44 cursor-pointer"
            >
              <option value="">Select type…</option>
              {(categoryOptions ?? []).map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Create
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-400">
          Created retailers are pre-approved (draft visibility). They still need to subscribe to go live.
        </p>
      </SectionCard>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap mt-6">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {tabs.map((t) => (
            <Link
              key={t}
              href={`/retailers${t === 'all' ? '' : `?status=${t}`}`}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors capitalize ${
                (status ?? 'all') === t && !activation
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </Link>
          ))}
          <Link
            href="/retailers?activation=not_activated"
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              activation === 'not_activated'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Not activated
          </Link>
        </div>
        <form method="GET">
          {status && <input type="hidden" name="status" value={status} />}
          {activation && <input type="hidden" name="activation" value={activation} />}
          <input
            type="search" name="q" defaultValue={q ?? ''}
            placeholder="Search by name…"
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-700"
          />
        </form>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="🏪"
          title="No retailers found"
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Approval</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Subscription</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Visibility</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const sub = subsByRetailerId[r.id];
                  const subStatus = sub?.status ?? 'none';
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{r.name}</div>
                        <div className="text-xs text-gray-400">{r.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.approval_status} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={subStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.visibility_status} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <form action={deactivateRetailer}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="is_active" value={String(r.is_active)} />
                            <button
                              type="submit"
                              className={`text-xs underline ${r.is_active ? 'text-red-500 hover:text-red-700' : 'text-green-700 hover:text-green-900'}`}
                            >
                              {r.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                          </form>
                          <Link href={`/retailers/${r.id}`}
                            className="text-sm text-green-700 hover:text-green-900 font-medium">
                            Review →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((r) => {
              const sub = subsByRetailerId[r.id];
              const subStatus = sub?.status ?? 'none';
              return (
                <div key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{r.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{r.slug}</p>
                    </div>
                    <Link href={`/retailers/${r.id}`} className="shrink-0 text-sm font-medium text-green-700">
                      Review →
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <StatusBadge status={r.approval_status} />
                    <StatusBadge status={subStatus} />
                    <StatusBadge status={r.visibility_status} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{formatDate(r.created_at)}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
