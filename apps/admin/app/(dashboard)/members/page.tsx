import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Members – Admin' };

const STATUS_CLASSES: Record<string, string> = {
  active:   'bg-green-100 text-green-800 border-green-200',
  trialing: 'bg-blue-100 text-blue-800 border-blue-200',
  past_due: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cancelled:'bg-red-100 text-red-800 border-red-200',
  expired:  'bg-gray-100 text-gray-700 border-gray-200',
  inactive: 'bg-gray-100 text-gray-500 border-gray-200',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function MembersPage({ searchParams }: Props) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const supabase = createServiceClient();

  let query = supabase
    .from('consumer_memberships')
    .select('id, status, plan_interval, current_period_end, started_at, stripe_subscription_id, profiles(full_name, email)')
    .order('started_at', { ascending: false })
    .limit(200);

  if (status && status !== 'all') query = query.eq('status', status);

  const { data: rows } = await query;
  const members = (rows ?? []) as any[];

  const filtered = q
    ? members.filter((m) => {
        const search = q.toLowerCase();
        return (
          (m.profiles?.full_name ?? '').toLowerCase().includes(search) ||
          (m.profiles?.email ?? '').toLowerCase().includes(search)
        );
      })
    : members;

  const statuses = ['all', 'active', 'trialing', 'past_due', 'cancelled', 'expired', 'inactive'];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="mt-1 text-sm text-gray-500">Consumer membership accounts and billing status.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/members${s === 'all' ? '' : `?status=${s}`}`}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              (s === 'all' && !status) || status === s
                ? 'bg-green-800 text-white border-green-800'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {s.replace('_', ' ')}
          </Link>
        ))}
        <form method="get" action="/members" className="ml-auto">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name or email…"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
          />
        </form>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border border-gray-200 rounded-lg bg-white">
          <p className="text-sm">No members found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Member</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Renews / Ends</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Started</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((m: any) => {
                const cls = STATUS_CLASSES[m.status] ?? STATUS_CLASSES.inactive;
                return (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{m.profiles?.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{m.profiles?.email ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
                        {m.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{m.plan_interval ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(m.current_period_end)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(m.started_at)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/members/${m.id}`}
                        className="text-xs text-green-700 font-medium hover:underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} member{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
