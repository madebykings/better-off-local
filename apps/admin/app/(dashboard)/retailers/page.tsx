import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { createRetailer, deactivateRetailer } from '@/lib/actions/admin';

export const metadata: Metadata = { title: 'Retailers – Admin' };

interface Props {
  searchParams: Promise<{ status?: string; q?: string; activation?: string }>;
}

const APPROVAL_BADGES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  suspended: 'bg-gray-200 text-gray-700 border-gray-300',
  changes_requested: 'bg-orange-100 text-orange-700 border-orange-200',
};

const VISIBILITY_BADGES: Record<string, string> = {
  live: 'bg-blue-100 text-blue-800 border-blue-200',
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  hidden: 'bg-orange-100 text-orange-700 border-orange-200',
};

const SUB_BADGES: Record<string, string> = {
  active:   'bg-green-100 text-green-800 border-green-200',
  inactive: 'bg-gray-100 text-gray-500 border-gray-200',
  past_due: 'bg-amber-100 text-amber-800 border-amber-200',
  cancelled:'bg-red-100 text-red-700 border-red-200',
  expired:  'bg-red-100 text-red-700 border-red-200',
  none:     'bg-gray-100 text-gray-400 border-gray-200',
};

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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Retailers</h1>
        <p className="text-sm text-gray-500 mt-1">Review, approve, and manage all retailers on the platform.</p>
      </div>

      {/* Add retailer */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Add retailer</h2>
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
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
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
        <div className="text-center py-16 border border-gray-200 rounded-lg text-gray-400">
          <p className="text-4xl mb-3">🏪</p>
          <p className="font-medium text-gray-600">No retailers found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
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
                const subLabel = subStatus === 'none' ? 'None' : subStatus.replace('_', ' ');
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.name}</div>
                      <div className="text-xs text-gray-400">{r.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${APPROVAL_BADGES[r.approval_status] ?? ''}`}>
                        {r.approval_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${SUB_BADGES[subStatus] ?? ''}`}>
                        {subLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${VISIBILITY_BADGES[r.visibility_status] ?? ''}`}>
                        {r.visibility_status}
                      </span>
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
      )}
    </div>
  );
}
