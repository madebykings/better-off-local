import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Audit log – Admin' };

interface Props {
  searchParams: Promise<{ table?: string; q?: string }>;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const ACTION_BADGES: Record<string, string> = {
  retailer_approved: 'bg-green-100 text-green-800 border-green-200',
  retailer_rejected: 'bg-red-100 text-red-800 border-red-200',
  retailer_suspended: 'bg-gray-200 text-gray-700 border-gray-300',
  retailer_visibility_set: 'bg-blue-100 text-blue-800 border-blue-200',
  offer_approved: 'bg-green-100 text-green-800 border-green-200',
  offer_rejected: 'bg-red-100 text-red-800 border-red-200',
  offer_paused: 'bg-orange-100 text-orange-700 border-orange-200',
  offer_reinstated: 'bg-blue-100 text-blue-800 border-blue-200',
};

const TARGET_TABLES = ['all', 'retailers', 'offers'];

export default async function AuditPage({ searchParams }: Props) {
  await requireAdmin();
  const { table, q } = await searchParams;
  const supabase = createServiceClient();

  let query = supabase
    .from('admin_actions')
    .select('id, action_type, target_table, target_id, reason, created_at, profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(200);

  if (table && table !== 'all') query = query.eq('target_table', table);

  const { data: actions } = await query;

  const filtered = (actions ?? []).filter((a: any) =>
    q
      ? a.action_type.includes(q.toLowerCase()) ||
        (a.reason ?? '').toLowerCase().includes(q.toLowerCase()) ||
        (a.profiles?.full_name ?? '').toLowerCase().includes(q.toLowerCase())
      : true,
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-gray-500 mt-1">Full history of admin moderation actions across the platform.</p>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {TARGET_TABLES.map((t) => (
            <Link
              key={t}
              href={`/audit${t === 'all' ? '' : `?table=${t}`}`}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors capitalize ${
                (table ?? 'all') === t
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </Link>
          ))}
        </div>
        <form method="GET">
          {table && <input type="hidden" name="table" value={table} />}
          <input
            type="search" name="q" defaultValue={q ?? ''}
            placeholder="Search action, reason, admin…"
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-700 w-64"
          />
        </form>
        <span className="text-xs text-gray-400 ml-auto">Showing last 200 actions</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-gray-200 rounded-lg text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium text-gray-600">No audit entries found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Target</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Admin</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((a: any) => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border font-mono ${ACTION_BADGES[a.action_type] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {a.action_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    <span className="capitalize">{a.target_table}</span>
                    {a.target_table === 'retailers' && (
                      <Link href={`/retailers/${a.target_id}`} className="ml-1 text-xs text-green-700 hover:underline">→</Link>
                    )}
                    {a.target_table === 'offers' && (
                      <Link href={`/offers/${a.target_id}`} className="ml-1 text-xs text-green-700 hover:underline">→</Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-[240px] truncate">
                    {a.reason || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.profiles?.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDateTime(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
