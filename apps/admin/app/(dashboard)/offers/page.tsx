import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Offers – Admin' };

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>;
}

const STATUS_BADGES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  live: 'bg-green-100 text-green-800 border-green-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  paused: 'bg-orange-100 text-orange-700 border-orange-200',
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  expired: 'bg-gray-200 text-gray-500 border-gray-300',
};

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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Offers</h1>
        <p className="text-sm text-gray-500 mt-1">Approve, reject, or pause offers across all retailers.</p>
      </div>

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
        <div className="text-center py-16 border border-gray-200 rounded-lg text-gray-400">
          <p className="text-4xl mb-3">🏷️</p>
          <p className="font-medium text-gray-600">No offers found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
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
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${STATUS_BADGES[o.status] ?? ''}`}>
                      {o.status}
                    </span>
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
      )}
    </div>
  );
}
