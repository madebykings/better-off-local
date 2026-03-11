import type { Metadata } from 'next';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Redemptions – Retailer Portal' };

type RedemptionRow = {
  id: string;
  status: string;
  rejection_reason: string | null;
  redeemed_at: string;
  offers: { title: string } | null;
  profiles: { full_name: string | null } | null;
};

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  success: { label: 'Redeemed', classes: 'bg-green-100 text-green-800 border-green-200' },
  rejected: { label: 'Rejected', classes: 'bg-red-100 text-red-800 border-red-200' },
  expired: { label: 'Expired', classes: 'bg-gray-100 text-gray-700 border-gray-200' },
  rule_blocked: { label: 'Blocked', classes: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  membership_invalid: { label: 'Membership issue', classes: 'bg-red-100 text-red-800 border-red-200' },
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

  const { data: redemptions } = await supabase
    .from('redemptions')
    .select('id, status, rejection_reason, redeemed_at, offers(title), profiles(full_name)')
    .eq('retailer_id', retailerId)
    .order('redeemed_at', { ascending: false })
    .limit(100);

  const rows = (redemptions ?? []) as RedemptionRow[];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Redemptions</h1>
        <p className="text-sm text-gray-500 mt-1">
          All redemption attempts for your offers, most recent first.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🎫</p>
          <p className="font-medium text-gray-600">No redemptions yet</p>
          <p className="text-sm mt-1">Redeemed offers will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Offer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Member</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const badge = STATUS_LABELS[r.status] ?? {
                  label: r.status,
                  classes: 'bg-gray-100 text-gray-600 border-gray-200',
                };
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate">
                      {r.offers?.title ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.profiles?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(r.redeemed_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">
                      {r.rejection_reason ?? '—'}
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
