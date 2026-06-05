import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader, StatusBadge, EmptyState } from '@better-off-local/ui';

export const metadata: Metadata = { title: 'Offers – Admin' };

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function OffersPage({ searchParams }: Props) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const supabase = createServiceClient();

  let query = supabase
    .from('offers')
    .select('id, title, status, start_at, end_at, created_at, retailers(id, name)')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);

  const { data: offers } = await query;

  const filtered = (offers ?? []).filter((o) =>
    q ? o.title.toLowerCase().includes(q.toLowerCase()) : true,
  );

  const tabs = ['all', 'pending', 'live', 'paused', 'rejected', 'expired', 'draft'];

  return (
    <div>
      <PageHeader
        title="Offers"
        description="Approve, reject, or pause offers across all retailers."
      />

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {tabs.map((t) => (
            <Link
              key={t}
              href={`/offers${t === 'all' ? '' : `?status=${t}`}`}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors capitalize ${
                (status ?? 'all') === t
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </Link>
          ))}
        </div>
        <form method="GET">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search" name="q" defaultValue={q ?? ''}
            placeholder="Search by title…"
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-700"
          />
        </form>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No offers found"
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Retailer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Validity</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{o.title}</td>
                    <td className="px-4 py-3">
                      {o.retailers ? (
                        <Link href={`/retailers/${o.retailers.id}`} className="text-green-700 hover:underline text-xs">
                          {o.retailers.name}
                        </Link>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {o.start_at ? formatDate(o.start_at) : 'Now'} → {o.end_at ? formatDate(o.end_at) : 'Ongoing'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/offers/${o.id}`}
                        className="text-sm text-green-700 hover:text-green-900 font-medium">
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((o: any) => (
              <div key={o.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{o.title}</p>
                    {o.retailers && (
                      <p className="text-xs text-gray-400 mt-0.5">{o.retailers.name}</p>
                    )}
                  </div>
                  <Link href={`/offers/${o.id}`} className="shrink-0 text-sm font-medium text-green-700">
                    Review →
                  </Link>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <StatusBadge status={o.status} />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {o.start_at ? formatDate(o.start_at) : 'Now'} → {o.end_at ? formatDate(o.end_at) : 'Ongoing'}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
