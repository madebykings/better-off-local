import type { Metadata } from 'next';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { MetricCard, PageHeader, SectionCard, GuidanceCard } from '@better-off-local/ui';
import { RetailerImpactCard } from '@/components/impact/RetailerImpactCard';
import { getPartnerTerms } from '@/lib/partner_type';

export const metadata: Metadata = { title: 'Analytics – Retailer Portal' };

// ── Types ────────────────────────────────────────────────────────────────────

type OfferRow = {
  id: string;
  title: string;
  status: string;
  is_featured: boolean;
};

type LoyaltyCardRow = {
  offer_id: string;
  status: string;
};

type ScanRow = {
  id: string;
  redeemed_at: string;
  status: string;
  offers: { title: string } | null;
  consumer: { full_name: string | null } | null;
  scanner: { full_name: string | null } | null;
};

type RedemptionValueRow = {
  offers: { estimated_saving_pence: number | null } | { estimated_saving_pence: number | null }[] | null;
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

function formatPounds(pence: number): string {
  const pounds = pence / 100;
  return `£${pounds.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sumSavings(rows: RedemptionValueRow[]): number {
  return rows.reduce((acc, r) => {
    const o = r.offers;
    if (!o) return acc;
    if (Array.isArray(o)) {
      return acc + o.reduce((s, x) => s + (x.estimated_saving_pence ?? 0), 0);
    }
    return acc + (o.estimated_saving_pence ?? 0);
  }, 0);
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
    loyaltyCardsResult,
    loyaltyOffersResult,
    venueReferralOffersResult,
    allRedemptionValueResult,
    monthRedemptionValueResult,
    primaryVenueResult,
    retailerDescriptionResult,
    eventsCountResult,
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

    // Loyalty cards for this retailer (status breakdown)
    supabase
      .from('loyalty_cards')
      .select('offer_id, status')
      .eq('retailer_id', retailerId),

    // Loyalty offers for this retailer (for per-offer breakdown)
    supabase
      .from('offers')
      .select('id, title')
      .eq('retailer_id', retailerId)
      .eq('offer_type', 'loyalty_visits')
      .in('status', ['live', 'paused', 'expired']),

    // Venue referral offers for this retailer
    supabase
      .from('offers')
      .select('id, title')
      .eq('retailer_id', retailerId)
      .eq('offer_type', 'venue_referral')
      .in('status', ['live', 'paused', 'expired']),

    // Value generated: all successful redemptions with saving value
    supabase
      .from('redemptions')
      .select('offers!inner(estimated_saving_pence)')
      .eq('retailer_id', retailerId)
      .eq('status', 'success'),

    // Value generated: this month only
    supabase
      .from('redemptions')
      .select('offers!inner(estimated_saving_pence)')
      .eq('retailer_id', retailerId)
      .eq('status', 'success')
      .gte('redeemed_at', monthStart.toISOString()),

    // Health score: primary venue (logo, opening hours)
    supabase
      .from('retailer_locations')
      .select('logo_url, opening_hours_json, description')
      .eq('retailer_id', retailerId)
      .eq('is_primary', true)
      .maybeSingle(),

    // Health score: retailer description + partner type
    supabase
      .from('retailers')
      .select('description, partner_type')
      .eq('id', retailerId)
      .single(),

    // Health score: events count
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId),
  ]);

  // ── Venue referral share links ────────────────────────────────────────────
  const vrShareLinksResult = await supabase
    .from('venue_referral_share_tokens')
    .select('offer_id')
    .in('offer_id', (venueReferralOffersResult.data ?? []).map((o: { id: string }) => o.id));

  // ── Venue referral secondary fetch ───────────────────────────────────────
  const venueReferralOffers = (venueReferralOffersResult.data ?? []) as { id: string; title: string }[];
  const vrOfferIds = venueReferralOffers.map((o) => o.id);

  const [vrInvitationsResult, vrRewardsResult] =
    vrOfferIds.length > 0
      ? await Promise.all([
          supabase.from('venue_referral_invitations').select('offer_id, was_existing_member').in('offer_id', vrOfferIds),
          supabase.from('venue_referral_rewards').select('offer_id, status').in('offer_id', vrOfferIds),
        ])
      : [{ data: [] }, { data: [] }];

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
  const repeatVisitRate =
    uniqueMembers > 0
      ? `${Math.round((returningCustomers / uniqueMembers) * 100)}%`
      : '0%';

  // ── Value generated ───────────────────────────────────────────────────────

  const allValueRows = (allRedemptionValueResult.data ?? []) as RedemptionValueRow[];
  const monthValueRows = (monthRedemptionValueResult.data ?? []) as RedemptionValueRow[];
  const lifetimeValuePence = sumSavings(allValueRows);
  const monthValuePence = sumSavings(monthValueRows);

  // ── Per-offer breakdown ───────────────────────────────────────────────────

  const offers = (offersResult.data ?? []) as unknown as OfferRow[];
  const liveOfferCount = offers.filter((o) => o.status === 'live').length;

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

  // ── Loyalty card metrics ───────────────────────────────────────────────────

  const loyaltyCards = (loyaltyCardsResult.data ?? []) as LoyaltyCardRow[];
  const loyaltyOffers = (loyaltyOffersResult.data ?? []) as { id: string; title: string }[];

  const totalCardsIssued = loyaltyCards.length;
  const activeCards = loyaltyCards.filter((c) => c.status === 'active').length;
  const completedCards = loyaltyCards.filter((c) => c.status === 'completed').length;
  const claimedRewards = loyaltyCards.filter((c) => c.status === 'claimed').length;

  const loyaltyCardsByOffer = new Map<string, LoyaltyCardRow[]>();
  for (const card of loyaltyCards) {
    const existing = loyaltyCardsByOffer.get(card.offer_id) ?? [];
    existing.push(card);
    loyaltyCardsByOffer.set(card.offer_id, existing);
  }
  const loyaltyOfferBreakdown = loyaltyOffers.map((o) => {
    const cards = loyaltyCardsByOffer.get(o.id) ?? [];
    const issued = cards.length;
    const active = cards.filter((c) => c.status === 'active').length;
    const completed = cards.filter((c) => c.status === 'completed').length;
    const claimed = cards.filter((c) => c.status === 'claimed').length;
    return { ...o, issued, active, completed, claimed, claimPct: pct(claimed, issued) };
  });

  // ── Venue referral metrics ────────────────────────────────────────────────

  const vrInvitations = (vrInvitationsResult.data ?? []) as { offer_id: string; was_existing_member: boolean | null }[];
  const vrRewards = (vrRewardsResult.data ?? []) as { offer_id: string; status: string }[];
  const vrShareLinks = (vrShareLinksResult.data ?? []) as { offer_id: string }[];

  const totalLinksShared = vrShareLinks.length;
  const totalInvitesSent = vrInvitations.length;
  const totalRewardsUnlocked = vrRewards.filter((r) => r.status === 'unlocked').length;
  const totalRewardsRedeemed = vrRewards.filter((r) => r.status === 'redeemed').length;
  const newBolMembersReferred = vrInvitations.filter((r) => r.was_existing_member === false).length;
  const existingBolMembersReferred = vrInvitations.filter((r) => r.was_existing_member === true).length;

  const vrInvitesByOffer = new Map<string, number>();
  for (const r of vrInvitations) {
    vrInvitesByOffer.set(r.offer_id, (vrInvitesByOffer.get(r.offer_id) ?? 0) + 1);
  }
  const vrSharesByOffer = new Map<string, number>();
  for (const r of vrShareLinks) {
    vrSharesByOffer.set(r.offer_id, (vrSharesByOffer.get(r.offer_id) ?? 0) + 1);
  }
  const vrNewBolByOffer = new Map<string, number>();
  for (const r of vrInvitations) {
    if (r.was_existing_member === false) {
      vrNewBolByOffer.set(r.offer_id, (vrNewBolByOffer.get(r.offer_id) ?? 0) + 1);
    }
  }
  const vrRewardsByOffer = new Map<string, { unlocked: number; redeemed: number }>();
  for (const r of vrRewards) {
    const cur = vrRewardsByOffer.get(r.offer_id) ?? { unlocked: 0, redeemed: 0 };
    if (r.status === 'unlocked') cur.unlocked++;
    if (r.status === 'redeemed') cur.redeemed++;
    vrRewardsByOffer.set(r.offer_id, cur);
  }
  const vrOfferBreakdown = venueReferralOffers.map((o) => {
    const links = vrSharesByOffer.get(o.id) ?? 0;
    const invited = vrInvitesByOffer.get(o.id) ?? 0;
    const newBol = vrNewBolByOffer.get(o.id) ?? 0;
    const { unlocked = 0, redeemed = 0 } = vrRewardsByOffer.get(o.id) ?? {};
    const converted = unlocked + redeemed;
    return { ...o, links, invited, newBol, converted, unlocked, redeemed, conversionPct: pct(converted, invited) };
  });

  // ── Business Health Score ─────────────────────────────────────────────────

  const primaryVenue = primaryVenueResult.data as {
    logo_url: string | null;
    opening_hours_json: unknown;
    description: string | null;
  } | null;
  const retailerDescriptionRow = retailerDescriptionResult.data as { description: string | null; partner_type: string | null } | null;
  const retailerDescription = retailerDescriptionRow?.description ?? null;
  const terms = getPartnerTerms(retailerDescriptionRow?.partner_type);
  const eventsCount = eventsCountResult.count ?? 0;

  const hasLiveOffers = liveOfferCount > 0;
  const hasLoyalty = loyaltyOffers.length > 0;
  const hasReferral = venueReferralOffers.length > 0;
  const hasEvents = eventsCount > 0;
  const hasDescription = !!(retailerDescription && retailerDescription.trim().length > 0);
  const hasLogo = !!(primaryVenue?.logo_url && primaryVenue.logo_url.trim().length > 0);
  const hasOpeningHours = !!(
    primaryVenue?.opening_hours_json &&
    typeof primaryVenue.opening_hours_json === 'object' &&
    Object.keys(primaryVenue.opening_hours_json as object).length > 0
  );

  const healthComponents = [
    { label: 'Live offers', met: hasLiveOffers, points: 20, href: '/offers' },
    { label: 'Loyalty programme', met: hasLoyalty, points: 15, href: '/offers/new?type=loyalty_visits' },
    { label: 'Referral campaign', met: hasReferral, points: 15, href: '/offers/new?type=venue_referral' },
    { label: 'Events listed', met: hasEvents, points: 10, href: '/events' },
    { label: terms.descriptionLabel, met: hasDescription, points: 15, href: '/settings/profile' },
    { label: 'Logo uploaded', met: hasLogo, points: 15, href: '/settings/profile' },
    { label: 'Opening hours set', met: hasOpeningHours, points: 10, href: '/settings/profile' },
  ];

  const healthScore = healthComponents.reduce((acc, c) => acc + (c.met ? c.points : 0), 0);

  const healthColor =
    healthScore >= 80
      ? { bar: 'bg-green-500', text: 'text-green-700', badge: 'bg-green-100 text-green-800 border-green-200' }
      : healthScore >= 50
      ? { bar: 'bg-amber-400', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800 border-amber-200' }
      : { bar: 'bg-red-500', text: 'text-red-700', badge: 'bg-red-100 text-red-800 border-red-200' };

  const healthLabel = healthScore >= 80 ? 'Great' : healthScore >= 50 ? 'Good' : 'Needs work';

  const recommendations = healthComponents.filter((c) => !c.met);

  // ── Success Journey Tier ──────────────────────────────────────────────────

  type Tier = { label: string; min: number; max: number };
  const tiers: Tier[] = [
    { label: 'Getting Started', min: 0, max: 39 },
    { label: 'Growing', min: 40, max: 69 },
    { label: 'Established', min: 70, max: 89 },
    { label: 'Power User', min: 90, max: 100 },
  ];
  const currentTierIndex = tiers.findIndex((t) => healthScore >= t.min && healthScore <= t.max);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Performance and health overview for your business on Better Off Local."
      />

      {/* ── Business Health Score ── */}
      <SectionCard title={terms.healthLabel}>
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Score display */}
          <div className="shrink-0 text-center md:text-left">
            <div className={`text-6xl font-bold tabular-nums ${healthColor.text}`}>
              {healthScore}
            </div>
            <div className="text-sm text-gray-500 mt-1">out of 100</div>
            <span
              className={`mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${healthColor.badge}`}
            >
              {healthLabel}
            </span>
          </div>

          {/* Progress bar + checklist */}
          <div className="flex-1 min-w-0">
            <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-5">
              <div
                className={`h-full rounded-full transition-all ${healthColor.bar}`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
            <ul className="space-y-2">
              {healthComponents.map((c) => (
                <li key={c.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={`text-base leading-none ${c.met ? 'text-green-500' : 'text-gray-300'}`}
                      aria-hidden="true"
                    >
                      {c.met ? '✓' : '✗'}
                    </span>
                    <span className={c.met ? 'text-gray-700' : 'text-gray-400'}>{c.label}</span>
                  </span>
                  <span className={`tabular-nums text-xs font-medium ${c.met ? 'text-green-600' : 'text-gray-400'}`}>
                    +{c.points}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">Recommendations</p>
            <div className="space-y-2">
              {recommendations.map((r) => (
                <GuidanceCard
                  key={r.label}
                  heading={r.label}
                  body={`Add +${r.points} points to your health score.`}
                  cta={{ label: 'Set up now', href: r.href }}
                />
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ── Success Journey ── */}
      <SectionCard title="Success Journey">
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {tiers.map((tier, i) => {
              const isActive = i === currentTierIndex;
              const isPast = i < currentTierIndex;
              return (
                <div
                  key={tier.label}
                  className={`rounded-lg px-3 py-2.5 text-center border transition-colors ${
                    isActive
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : isPast
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  <div className="text-xs font-semibold leading-tight">{tier.label}</div>
                  <div className="text-xs mt-0.5 opacity-70">{tier.min}–{tier.max}</div>
                </div>
              );
            })}
          </div>
          <div className="relative h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${healthScore}%` }}
            />
          </div>
          <p className="text-sm text-gray-500">
            You are currently at the{' '}
            <span className="font-medium text-gray-700">
              {tiers[currentTierIndex]?.label ?? 'Getting Started'}
            </span>{' '}
            stage with a health score of {healthScore}/100.
            {currentTierIndex < tiers.length - 1 && (
              <> Reach {tiers[currentTierIndex + 1]?.min} to unlock the next stage.</>
            )}
          </p>
        </div>
      </SectionCard>

      {/* ── Value Generated ── */}
      <SectionCard title="Value Generated for Members">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div>
            <div className="text-4xl font-bold text-gray-900 tabular-nums">
              {lifetimeValuePence > 0 ? formatPounds(lifetimeValuePence) : '—'}
            </div>
            <p className="text-sm text-gray-500 mt-1">generated for members lifetime</p>
          </div>
          <div className="sm:border-l sm:border-gray-200 sm:pl-6 space-y-1">
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">
                {monthValuePence > 0 ? formatPounds(monthValuePence) : '—'}
              </span>{' '}
              this month
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{totalSuccessful}</span> total redemptions
            </div>
          </div>
        </div>
        {lifetimeValuePence === 0 && totalSuccessful === 0 && (
          <p className="mt-4 text-sm text-gray-400">
            Value will appear once members start redeeming your offers.
          </p>
        )}
      </SectionCard>

      {/* ── Feature Adoption ── */}
      <SectionCard title="Feature Adoption">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Active</p>
            {healthComponents.filter((c) => c.met).length === 0 ? (
              <p className="text-sm text-gray-400">No features active yet.</p>
            ) : (
              <ul className="space-y-2">
                {healthComponents
                  .filter((c) => c.met)
                  .map((c) => (
                    <li key={c.label} className="flex items-center gap-2 text-sm text-gray-700">
                      <span className="text-green-500 text-base leading-none" aria-hidden="true">✓</span>
                      {c.label}
                    </li>
                  ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Suggested next steps</p>
            {recommendations.length === 0 ? (
              <p className="text-sm text-gray-500">All features active — your profile is complete.</p>
            ) : (
              <ul className="space-y-2">
                {recommendations.map((r) => (
                  <li key={r.label} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-300 text-base leading-none" aria-hidden="true">✗</span>
                    <a href={r.href} className="text-indigo-600 hover:underline">
                      {r.label}
                    </a>
                    <span className="text-xs text-gray-400">(+{r.points} pts)</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Your Impact ── */}
      <div>
        <h2 className="text-lg font-semibold mb-1">Your Impact</h2>
        <p className="text-sm text-gray-500 mb-4">
          How your business is contributing to the local community.
        </p>
        <RetailerImpactCard retailerId={retailerId} />
      </div>

      {/* ── Member Engagement ── */}
      <SectionCard title="Member Engagement">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetricCard label="Offer views" value={totalViews} />
          <MetricCard label="Offer saves" value={totalSaves} />
          <MetricCard label="QR codes generated" value={totalTokens} />
          <MetricCard label="Redemptions today" value={claimedToday} />
          <MetricCard label="Redemptions this month" value={claimedMonth} />
          <MetricCard label="Redemptions all time" value={totalSuccessful} />
        </div>
      </SectionCard>

      {/* ── Customer Acquisition ── */}
      <SectionCard title={`${terms.customer} Acquisition`}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetricCard label={`New ${terms.customers.toLowerCase()}`} value={newCustomers} />
          <MetricCard label={`Repeat ${terms.customers.toLowerCase()}`} value={returningCustomers} />
          <MetricCard label="Repeat visit rate" value={repeatVisitRate} />
          <MetricCard label="Unique members" value={uniqueMembers} />
          <MetricCard label="Referral invitations" value={totalInvitesSent} />
          <MetricCard label="Referral conversions" value={totalRewardsUnlocked + totalRewardsRedeemed} />
        </div>
      </SectionCard>

      {/* ── Per-offer breakdown ── */}
      <div>
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

      {/* ── Loyalty stamp cards ── */}
      {(totalCardsIssued > 0 || loyaltyOffers.length > 0) && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Loyalty stamp cards</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
            <MetricCard label="Cards issued" value={totalCardsIssued} />
            <MetricCard label="Active" value={activeCards} />
            <MetricCard label="Completed" value={completedCards} />
            <MetricCard label="Rewards claimed" value={claimedRewards} />
          </div>
          {loyaltyOfferBreakdown.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Loyalty offer</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Issued</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Active</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Completed</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Claimed</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Claim %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loyaltyOfferBreakdown.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[220px] truncate">{o.title}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{o.issued}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{o.active}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{o.completed}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{o.claimed}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{o.claimPct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Venue referral rewards ── */}
      {(totalLinksShared > 0 || totalInvitesSent > 0 || venueReferralOffers.length > 0) && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Venue referral rewards</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-5">
            <MetricCard label="Links shared" value={totalLinksShared} />
            <MetricCard label="Friends invited" value={totalInvitesSent} />
            <MetricCard label="New BOL members" value={newBolMembersReferred} />
            <MetricCard label="Rewards unlocked" value={totalRewardsUnlocked} />
            <MetricCard label="Rewards redeemed" value={totalRewardsRedeemed} />
          </div>
          {existingBolMembersReferred > 0 && (
            <p className="text-xs text-gray-500 mb-4">
              {existingBolMembersReferred} invitation{existingBolMembersReferred !== 1 ? 's were' : ' was'} from existing BOL members
              (counted in &ldquo;Friends invited&rdquo; but not &ldquo;New BOL members&rdquo;).
            </p>
          )}
          {vrOfferBreakdown.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Referral offer</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Links</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Invited</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">New BOL</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Unlocked</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Redeemed</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Conv. %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {vrOfferBreakdown.map((o) => (
                    <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate">{o.title}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{o.links}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{o.invited}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{o.newBol}</td>
                      <td className="px-3 py-3 text-right text-gray-700">{o.unlocked}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{o.redeemed}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{o.conversionPct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Recent scans ── */}
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
