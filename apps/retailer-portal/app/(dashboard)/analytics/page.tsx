import type { Metadata } from 'next';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Analytics – Retailer Portal' };

// ── Types ────────────────────────────────────────────────────────────────────

type OfferRow = {
  id: string;
  title: string;
  status: string;
  is_featured: boolean;
};

type ScanRow = {
  id: string;
  redeemed_at: string;
  status: string;
  offers: { title: string } | null;
  consumer: { full_name: string | null } | null;
  scanner: { full_name: string | null } | null;
};

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  success: { label: 'Redeemed', classes: 'bg-green-100 text-green-800 border-green-200' },
  rejected: { label: 'Rejected', classes: 'bg-red-100 text-red-800 border-red-200' },
  expired: { label: 'Expired', classes: 'bg-gray-100 text-gray-700 border-gray-200' },
  rule_blocked: { label: 'Blocked', classes: 'bg-amber-100 text-amber-800 border-amber-200' },
  membership_invalid: { label: 'Membership issue', classes: 'bg-red-100 text-red-800 border-red-200' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '—';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  // Date boundaries (UTC)
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // ── Parallel data fetch ──────────────────────────────────────────────────
  const [
    viewsResult,
    savesResult,
    tokensResult,
    allSuccessResult,
    todayResult,
    monthResult,
    offersResult,
    viewsPerOfferResult,
    savesPerOfferResult,
    tokensPerOfferResult,
    successPerOfferResult,
    recentScansResult,
  ] = await Promise.all([
    // Headline: total offer views at this retailer
    supabase
      .from('offer_views')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId),

    // Headline: offer saves (favourites where offer_id is set)
    supabase
      .from('favourites')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId)
      .not('offer_id', 'is', null),

    // Headline: QR codes generated
    supabase
      .from('redemption_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId),

    // Headline: all successful redemptions (profile_id for new/returning calc)
    supabase
      .from('redemptions')
      .select('profile_id')
      .eq('retailer_id', retailerId)
      .eq('status', 'success'),

    // Headline: claimed today
    supabase
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId)
      .eq('status', 'success')
      .gte('redeemed_at', todayStart.toISOString()),

    // Headline: claimed this month
    supabase
      .from('redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId)
      .eq('status', 'success')
      .gte('redeemed_at', monthStart.toISOString()),

    // Per-offer breakdown: offer list
    supabase
      .from('offers')
      .select('id, title, status, is_featured')
      .eq('retailer_id', retailerId)
      .in('status', ['live', 'paused', 'expired'])
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: true }),

    // Per-offer: views (offer_id only for grouping)
    supabase
      .from('offer_views')
      .select('offer_id')
      .eq('retailer_id', retailerId),

    // Per-offer: saves
    supabase
      .from('favourites')
      .select('offer_id')
      .eq('retailer_id', retailerId)
      .not('offer_id', 'is', null),

    // Per-offer: QR tokens
    supabase
      .from('redemption_tokens')
      .select('offer_id')
      .eq('retailer_id', retailerId),

    // Per-offer: successful redemptions
    supabase
      .from('redemptions')
      .select('offer_id')
      .eq('retailer_id', retailerId)
      .eq('status', 'success'),

    // Recent scans (last 25) with consumer + scanner names
    supabase
      .from('redemptions')
      .select(
        'id, redeemed_at, status, offers(title), ' +
        'consumer:profiles!redemptions_profile_id_fkey(full_name), ' +
        'scanner:profiles!redemptions_validated_by_profile_id_fkey(full_name)'
      )
      .eq('retailer_id', retailerId)
      .order('redeemed_at', { ascending: false })
      .limit(25),
  ]);

  // ── Derived headline metrics ──────────────────────────────────────────────

  const totalViews = viewsResult.count ?? 0;
  const totalSaves = savesResult.count ?? 0;
  const totalTokens = tokensResult.count ?? 0;
  const claimedToday = todayResult.count ?? 0;
  const claimedMonth = monthResult.count ?? 0;

  // new / returning / repeat visit %
  const allSuccessRows = (allSuccessResult.data ?? []) as { profile_id: string }[];
  const redemptionsByProfile = new Map<string, number>();
  for (const row of allSuccessRows) {
    redemptionsByProfile.set(
      row.profile_id,
      (redemptionsByProfile.get(row.profile_id) ?? 0) + 1,
    );
  }
  const uniqueMembers = redemptionsByProfile.size;
  const totalSuccessful = allSuccessRows.length;
  let newCustomers = 0;
  let returningCustomers = 0;
  for (const count of redemptionsByProfile.values()) {
    if (count === 1) newCustomers++;
    else returningCustomers++;
  }
  const repeatVisitPct =
    uniqueMembers > 0
      ? `${Math.round((returningCustomers / uniqueMembers) * 100)}%`
      : '—';

  // ── Per-offer breakdown ───────────────────────────────────────────────────

  const offers = (offersResult.data ?? []) as unknown as OfferRow[];

  // Build count maps: offer_id → count
  const viewsByOffer = new Map<string, number>();
  for (const r of (viewsPerOfferResult.data ?? []) as { offer_id: string }[]) {
    viewsByOffer.set(r.offer_id, (viewsByOffer.get(r.offer_id) ?? 0) + 1);
  }
  const savesByOffer = new Map<string, number>();
  for (const r of (savesPerOfferResult.data ?? []) as { offer_id: string }[]) {
    savesByOffer.set(r.offer_id, (savesByOffer.get(r.offer_id) ?? 0) + 1);
  }
  const tokensByOffer = new Map<string, number>();
  for (const r of (tokensPerOfferResult.data ?? []) as { offer_id: string }[]) {
    tokensByOffer.set(r.offer_id, (tokensByOffer.get(r.offer_id) ?? 0) + 1);
  }
  const successByOffer = new Map<string, number>();
  for (const r of (successPerOfferResult.data ?? []) as { offer_id: string }[]) {
    successByOffer.set(r.offer_id, (successByOffer.get(r.offer_id) ?? 0) + 1);
  }

  const offerBreakdown = offers.map((o) => {
    const views = viewsByOffer.get(o.id) ?? 0;
    const saves = savesByOffer.get(o.id) ?? 0;
    const tokens = tokensByOffer.get(o.id) ?? 0;
    const redeemed = successByOffer.get(o.id) ?? 0;
    return { ...o, views, saves, tokens, redeemed, savePct: pct(saves, views), redemptionPct: pct(redeemed, views) };
  });

  // ── Recent scans ──────────────────────────────────────────────────────────

  const recentScans = (recentScansResult.data ?? []) as unknown as ScanRow[];

  // ── Headline card definitions ─────────────────────────────────────────────

  const headlineCards = [
    { label: 'Offer views', value: totalViews },
    { label: 'Saves', value: totalSaves },
    { label: 'QR generated', value: totalTokens },
    { label: 'Successful redemptions', value: totalSuccessful },
    { label: 'Unique members', value: uniqueMembers },
    { label: 'Claimed today', value: claimedToday },
    { label: 'Claimed this month', value: claimedMonth },
    { label: 'New customers', value: newCustomers },
    { label: 'Returning customers', value: returningCustomers },
    { label: 'Repeat visit %', value: repeatVisitPct },
  ] as const;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          All-time performance for your offers and redemptions.
        </p>
      </div>

      {/* Headline cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-8">
        {headlineCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-lg border border-gray-200 p-4"
          >
            <div className="text-2xl font-bold text-gray-900">
              {card.value}
            </div>
            <div className="text-xs text-gray-500 mt-1 leading-tight">
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Per-offer breakdown */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Per offer</h2>
        {offerBreakdown.length === 0 ? (
          <div className="border border-gray-200 rounded-lg py-12 text-center">
            <p className="font-medium text-gray-600">No offers yet</p>
            <p className="text-sm text-gray-400 mt-1">Your offers will appear here once created.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Offer</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Views</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Saved</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">QR</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Redeemed</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Save %</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Redeem %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {offerBreakdown.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="font-medium text-gray-800 truncate">{o.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5 capitalize">{o.status}</div>
                    </td>
                    <td className="px-3 py-3 text-right text-gray-700">{o.views}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{o.saves}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{o.tokens}</td>
                    <td className="px-3 py-3 text-right text-gray-700">{o.redeemed}</td>
                    <td className="px-3 py-3 text-right text-gray-500">{o.savePct}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{o.redemptionPct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent scans */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recent scans</h2>
        {recentScans.length === 0 ? (
          <div className="border border-gray-200 rounded-lg py-12 text-center">
            <p className="font-medium text-gray-600">No scans yet</p>
            <p className="text-sm text-gray-400 mt-1">Redemption scans will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Offer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Result</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Scanned by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentScans.map((r) => {
                  const badge = STATUS_LABELS[r.status] ?? {
                    label: r.status,
                    classes: 'bg-gray-100 text-gray-600 border-gray-200',
                  };
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatTime(r.redeemed_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-800 max-w-[180px] truncate font-medium">
                        {r.offers?.title ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {r.consumer?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {r.scanner?.full_name ?? '—'}
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
