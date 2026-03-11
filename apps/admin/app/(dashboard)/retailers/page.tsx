import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Retailers – Admin' };

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>;
}

const APPROVAL_BADGES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  suspended: 'bg-gray-200 text-gray-700 border-gray-300',
};

const VISIBILITY_BADGES: Record<string, string> = {
  live: 'bg-blue-100 text-blue-800 border-blue-200',
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  hidden: 'bg-orange-100 text-orange-700 border-orange-200',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function RetailersPage({ searchParams }: Props) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const supabase = createServiceClient();

  let query = supabase
    .from('retailers')
    .select('id, name, slug, approval_status, visibility_status, is_active, created_at')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('approval_status', status);

  const { data: retailers } = await query;

  const filtered = (retailers ?? []).filter((r) =>
    q ? r.name.toLowerCase().includes(q.toLowerCase()) : true,
  );

  const tabs = ['all', 'pending', 'approved', 'rejected', 'suspended'];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Retailers</h1>
        <p className="text-sm text-gray-500 mt-1">Review, approve, and manage all retailers on the platform.</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {tabs.map((t) => (
            <Link
              key={t}
              href={`/retailers${t === 'all' ? '' : `?status=${t}`}`}
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
            placeholder="Search by name…"
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-600"
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
                <th className="text-left px-4 py-3 font-medium text-gray-600">Visibility</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
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
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${VISIBILITY_BADGES[r.visibility_status] ?? ''}`}>
                      {r.visibility_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/retailers/${r.id}`}
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
