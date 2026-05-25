import type { Metadata } from 'next';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { ActivationStatusCard } from '@/components/dashboard/activation_status_card';

export const metadata: Metadata = { title: 'Dashboard – Retailer Portal' };

type RecentRedemption = {
  id: string;
  status: string;
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
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function DashboardPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const [retailerResult, subscriptionResult, liveOffersResult, redemptionsResult, viewsResult, savesResult, recentResult] =
    await Promise.all([
      supabase
        .from('retailers')
        .select('approval_status, visibility_status')
        .eq('id', retailerId)
        .single(),
      supabase
        .from('retailer_subscriptions')
        .select('status, current_period_end')
        .eq('retailer_id', retailerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('offers')
        .select('id', { count: 'exact', head: true })
        .eq('retailer_id', retailerId)
        .eq('status', 'live'),
      supabase
        .from('redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('retailer_id', retailerId)
        .eq('status', 'success'),
      supabase
        .from('offer_views')
        .select('id', { count: 'exact', head: true })
        .eq('retailer_id', retailerId),
      supabase
        .from('favourites')
        .select('id', { count: 'exact', head: true })
        .eq('retailer_id', retailerId),
      supabase
        .from('redemptions')
        .select('id, status, redeemed_at, offers(title), profiles!redemptions_profile_id_fkey(full_name)')
        .eq('retailer_id', retailerId)
        .order('redeemed_at', { ascending: false })
        .limit(5),
    ]);

  const retailer = retailerResult.data;
  const subscription = subscriptionResult.data;

  const liveOffers = liveOffersResult.count ?? 0;
  const totalRedemptions = redemptionsResult.count ?? 0;
  const totalViews = viewsResult.count ?? 0;
  const totalSaves = savesResult.count ?? 0;
  const recentRedemptions = (recentResult.data ?? []) as unknown as RecentRedemption[];

  const metrics = [
    { label: 'Live offers', value: liveOffers, icon: '🏷️' },
    { label: 'Total redemptions', value: totalRedemptions, icon: '✅' },
    { label: 'Offer views', value: totalViews, icon: '👁️' },
    { label: 'Saves', value: totalSaves, icon: '❤️' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Overview of your account activity.
        </p>
      </div>

      {/* Activation status */}
      {retailer && (
        <div className="mb-6">
          <ActivationStatusCard
            approvalStatus={retailer.approval_status as 'pending' | 'approved' | 'rejected' | 'suspended' | 'changes_requested'}
            subscriptionStatus={(subscription?.status ?? null) as 'inactive' | 'active' | 'past_due' | 'cancelled' | 'expired' | null}
            visibilityStatus={retailer.visibility_status}
            periodEnd={subscription?.current_period_end ?? null}
          />
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="bg-white rounded-lg border border-gray-200 p-4"
          >
            <div className="text-2xl mb-1">{m.icon}</div>
            <div className="text-2xl font-bold text-gray-900">{m.value}</div>
            <div className="text-xs text-gray-500 mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Recent redemptions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent redemptions</h2>
        {recentRedemptions.length === 0 ? (
          <div className="text-center py-10 text-gray-400 border border-gray-200 rounded-lg">
            <p className="text-3xl mb-2">🎫</p>
            <p className="text-sm">No redemptions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Offer</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Member</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentRedemptions.map((r) => {
                  const badge = STATUS_LABELS[r.status] ?? {
                    label: r.status,
                    classes: 'bg-gray-100 text-gray-600 border-gray-200',
                  };
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
