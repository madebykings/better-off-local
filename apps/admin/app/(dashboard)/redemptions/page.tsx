import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Redemptions – Admin' };

const STATUS_CLASSES: Record<string, { label: string; cls: string }> = {
  success:           { label: 'Success',            cls: 'bg-green-100 text-green-800 border-green-200' },
  rejected:          { label: 'Rejected',           cls: 'bg-red-100 text-red-800 border-red-200' },
  expired:           { label: 'Expired',            cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  rule_blocked:      { label: 'Rule blocked',       cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  membership_invalid:{ label: 'Membership invalid', cls: 'bg-red-100 text-red-800 border-red-200' },
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function RedemptionsPage({ searchParams }: Props) {
  await requireAdmin();
  const { status, q } = await searchParams;
  const supabase = createServiceClient();

  let query = supabase
    .from('redemptions')
    .select(
      'id, redeemed_at, status, ' +
      'offers(title), retailers(name), ' +
      'consumer:profiles!redemptions_profile_id_fkey(full_name, email)'
    )
    .order('redeemed_at', { ascending: false })
    .limit(300);

  if (status && status !== 'all') query = query.eq('status', status);

  const { data: rows } = await query;
  const redemptions = (rows ?? []) as any[];

  const filtered = q
    ? redemptions.filter((r) => {
        const search = q.toLowerCase();
        return (
          (r.consumer?.full_name ?? '').toLowerCase().includes(search) ||
          (r.offers?.title ?? '').toLowerCase().includes(search) ||
          (r.retailers?.name ?? '').toLowerCase().includes(search)
        );
      })
    : redemptions;

  const statuses = ['all', 'success', 'rejected', 'expired', 'rule_blocked', 'membership_invalid'];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Redemptions</h1>
        <p className="mt-1 text-sm text-gray-500">All redemption attempts across the platform.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {statuses.map((s) => (
          <Link
            key={s}
            href={`/redemptions${s === 'all' ? '' : `?status=${s}`}`}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              (s === 'all' && !status) || status === s
                ? 'bg-green-800 text-white border-green-800'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {STATUS_CLASSES[s]?.label ?? s}
          </Link>
        ))}
        <form method="get" action="/redemptions" className="ml-auto">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search member or offer…"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
          />
        </form>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 border border-gray-200 rounded-lg bg-white">
          <p className="text-sm">No redemptions found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Member</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Offer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Retailer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r: any) => {
                const badge = STATUS_CLASSES[r.status] ?? { label: r.status, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDateTime(r.redeemed_at)}</td>
                    <td className="px-4 py-3">
                      <div className="text-gray-800">{r.consumer?.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-400">{r.consumer?.email ?? ''}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">{r.offers?.title ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{r.retailers?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
            {filtered.length} redemption{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
