import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { ActivationStatusCard } from '@/components/dashboard/activation_status_card';
import { MetricCard, PageHeader, SectionCard, EmptyState, StatusBadge } from '@better-off-local/ui';

export const metadata: Metadata = { title: 'Dashboard – Retailer Portal' };

type RecentRedemption = {
  id: string;
  status: string;
  redeemed_at: string;
  offers: { title: string } | null;
  profiles: { full_name: string | null } | null;
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
        .select('approval_status, visibility_status, review_notes')
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

  // Fetch primary venue billing status for growth-region handling
  const { data: primaryVenue } = await supabase
    .from('retailer_locations')
    .select('billing_status')
    .eq('retailer_id', retailerId)
    .eq('is_primary', true)
    .eq('is_active', true)
    .maybeSingle();

  const liveOffers = liveOffersResult.count ?? 0;
  const totalRedemptions = redemptionsResult.count ?? 0;
  const totalViews = viewsResult.count ?? 0;
  const totalSaves = savesResult.count ?? 0;
  const recentRedemptions = (recentResult.data ?? []) as unknown as RecentRedemption[];

  function TagIcon() {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
      </svg>
    );
  }
  function CheckBadgeIcon() {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
      </svg>
    );
  }
  function EyeIcon() {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    );
  }
  function BookmarkIcon() {
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
      </svg>
    );
  }

  const metrics = [
    { label: 'Live offers', value: liveOffers, icon: <TagIcon /> },
    { label: 'Total redemptions', value: totalRedemptions, icon: <CheckBadgeIcon /> },
    { label: 'Offer views', value: totalViews, icon: <EyeIcon /> },
    { label: 'Saves', value: totalSaves, icon: <BookmarkIcon /> },
  ];

  const whatsNext = (() => {
    if (liveOffers === 0) {
      return {
        heading: 'Create your first offer',
        description: "Members can't find you yet. Add at least one offer to appear in the member app.",
        href: '/offers/new',
        linkLabel: 'Create an offer',
      };
    }
    if (totalRedemptions === 0) {
      return {
        heading: 'Share your listing',
        description: 'You have live offers but no redemptions yet. Share your link with customers.',
        href: null,
        linkLabel: null,
      };
    }
    return {
      heading: 'Keep your offers fresh',
      description: 'Members love new deals. Consider adding a seasonal offer.',
      href: '/offers/new',
      linkLabel: 'Add an offer',
    };
  })();

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your account activity." />

      {/* Activation status */}
      {retailer && (
        <div className="mb-6">
          <ActivationStatusCard
            approvalStatus={retailer.approval_status as 'pending' | 'approved' | 'rejected' | 'suspended' | 'changes_requested'}
            subscriptionStatus={(subscription?.status ?? null) as 'inactive' | 'active' | 'past_due' | 'cancelled' | 'expired' | null}
            visibilityStatus={retailer.visibility_status}
            periodEnd={subscription?.current_period_end ?? null}
            billingStatus={(primaryVenue?.billing_status ?? null) as string | null}
            reviewNotes={(retailer as any).review_notes ?? null}
            liveOfferCount={liveOffers}
          />
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        {metrics.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} icon={m.icon} />
        ))}
      </div>

      {/* What's next */}
      <div className="mb-8">
        <SectionCard title="What's next">
          <div className="flex items-start gap-3">
            <span className="text-green-700 text-lg leading-none mt-0.5" aria-hidden="true">→</span>
            <div className="min-w-0">
              <p className="font-medium text-gray-800">{whatsNext.heading}</p>
              <p className="text-sm text-gray-500 mt-1">{whatsNext.description}</p>
              {whatsNext.href && (
                <Link
                  href={whatsNext.href}
                  className="inline-block mt-3 text-sm font-medium text-green-700 hover:text-green-900 hover:underline"
                >
                  {whatsNext.linkLabel}
                </Link>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Recent redemptions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent redemptions</h2>
        {recentRedemptions.length === 0 ? (
          <EmptyState title="No redemptions yet" description="Redemptions will appear here once members start redeeming your offers." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Offer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentRedemptions.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
