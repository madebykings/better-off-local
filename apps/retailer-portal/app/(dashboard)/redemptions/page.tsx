import type { Metadata } from 'next';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { PageHeader, StatusBadge, EmptyState } from '@better-off-local/ui';

export const metadata: Metadata = { title: 'Redemptions – Retailer Portal' };

type RedemptionRow = {
  id: string;
  status: string;
  rejection_reason: string | null;
  redeemed_at: string;
  offers: { title: string } | null;
  profiles: { full_name: string | null } | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Server-rendered redemption history for the current retailer.
 * Data is fetched server-side using the service role to bypass RLS and join
 * offer/profile data. The retailer_id is validated via requireRetailerUser().
 */
export default async function RedemptionsPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const { data: redemptions, error: redemptionsError } = await supabase
    .from('redemptions')
    .select('id, status, rejection_reason, redeemed_at, offers!offer_id(title), profiles!profile_id(full_name)')
    .eq('retailer_id', retailerId)
    .order('redeemed_at', { ascending: false })
    .limit(100);

  if (redemptionsError) {
    console.error('[RedemptionsPage] query error:', redemptionsError.message);
  }

  const rows = (redemptions ?? []) as unknown as RedemptionRow[];

  return (
    <div>
      <PageHeader
        title="Redemptions"
        description="All redemption attempts for your offers, most recent first."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No redemptions yet"
          description="Redeemed offers will appear here."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Offer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate">
                      {r.offers?.title ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.profiles?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(r.redeemed_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">
                      {r.rejection_reason ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-gray-800 min-w-0 truncate block">
                    {r.offers?.title ?? '—'}
                  </span>
                  <StatusBadge status={r.status} />
                </div>
                <p className="text-sm text-gray-600 mt-1">{r.profiles?.full_name ?? '—'}</p>
                <p className="text-xs text-gray-400 mt-2">{formatDate(r.redeemed_at)}</p>
                {r.rejection_reason && (
                  <p className="text-xs text-gray-400 mt-1 truncate">{r.rejection_reason}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
