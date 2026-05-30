import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import { ReviewActionPanel, StatusBadge } from '@/components/review/review_action_panel';
import { ReviewTimeline } from '@/components/review/review_timeline';
import { RetailerListingCard, type ListingCardData } from '@/components/review/retailer_listing_card';
import {
  approveRetailer,
  rejectRetailer,
  requestRetailerChanges,
} from '@/lib/actions/moderation';
import { setVenueAllowanceOverride, deactivateRetailerVenue } from '@/lib/actions/admin';

export const metadata: Metadata = { title: 'Retailer review – Admin' };

interface Props {
  params: Promise<{ retailerId: string }>;
}

// ---------------------------------------------------------------------------
// Quality score (same weights as review queue + retailer portal)
// ---------------------------------------------------------------------------

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

function hasOpenDay(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  return DAY_KEYS.some((day) => {
    const entry = (raw as Record<string, unknown>)[day];
    if (!entry || typeof entry !== 'object') return false;
    return (entry as Record<string, unknown>).open === true;
  });
}

function computeQualityScore(params: {
  name: string | null;
  description: string | null;
  tagline: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  categoryCount: number;
  hasAddress: boolean;
  hasOpenDay: boolean;
  hasContact: boolean;
  hasOffer: boolean;
}): number {
  let score = 0;
  if (params.name?.trim())                                   score += 10;
  if (params.description?.trim() || params.tagline?.trim()) score += 10;
  if (params.cover_image_url)                               score += 15;
  if (params.logo_url)                                      score += 5;
  if (params.categoryCount > 0)                            score += 10;
  if (params.hasAddress)                                    score += 10;
  if (params.hasOpenDay)                                    score += 10;
  if (params.hasContact)                                    score += 15;
  if (params.hasOffer)                                      score += 15;
  return score;
}

function QualityBadge({ score }: { score: number }) {
  const cls =
    score >= 95
      ? 'bg-green-100 text-green-700 border-green-200'
      : score >= 75
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-red-100 text-red-700 border-red-200';
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {score}/100
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RetailerDetailPage({ params }: Props) {
  await requireAdmin();
  const { retailerId } = await params;
  const supabase = createServiceClient();

  const [
    { data: retailer },
    { data: categoryRows },
    { data: location },
    { data: links },
    { data: offer },
    { data: auditRows },
    { data: venues },
    { data: subData },
  ] = await Promise.all([
    supabase
      .from('retailers')
      .select('*, name, tagline, description, logo_url, cover_image_url, phone, email, approval_status, onboarding_step, submitted_at, updated_at, slug')
      .eq('id', retailerId)
      .single(),
    supabase
      .from('retailer_categories')
      .select('categories(name, slug)')
      .eq('retailer_id', retailerId),
    supabase
      .from('retailer_locations')
      .select('address_line_1, address_line_2, town, county, postcode, opening_hours_json')
      .eq('retailer_id', retailerId)
      .eq('is_primary', true)
      .maybeSingle(),
    supabase
      .from('retailer_links')
      .select('type, url')
      .eq('retailer_id', retailerId),
    supabase
      .from('offers')
      .select('id, title, value_text, description, offer_type, start_at, end_at')
      .eq('retailer_id', retailerId)
      .eq('onboarding_source', 'first-offer')
      .maybeSingle(),
    supabase
      .from('admin_actions')
      .select('id, action_type, reason, created_at, profiles(full_name)')
      .eq('target_table', 'retailers')
      .eq('target_id', retailerId)
      .order('created_at', { ascending: false }),
    supabase
      .from('retailer_locations')
      .select('id, name, address_line_1, town, postcode, is_primary, is_active')
      .eq('retailer_id', retailerId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('retailer_subscriptions')
      .select('extra_venues_quantity, venue_allowance_override')
      .eq('retailer_id', retailerId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  if (!retailer) notFound();

  // Offer rules (sequential — depends on offer.id).
  let offerRules = null;
  if (offer?.id) {
    const { data: rules } = await supabase
      .from('offer_rules')
      .select('max_redemptions_per_user, max_redemptions_per_day, cooldown_hours, max_redemptions_total')
      .eq('offer_id', offer.id)
      .maybeSingle();
    offerRules = rules ?? null;
  }

  // ── Build listing card data ──────────────────────────────────────────────
  const categories = (categoryRows ?? [])
    .map((row) => (row.categories as unknown) as { name: string; slug: string } | null)
    .filter((c): c is { name: string; slug: string } => Boolean(c));

  const listingData: ListingCardData = {
    retailer: {
      name:            retailer.name            ?? null,
      tagline:         retailer.tagline         ?? null,
      description:     retailer.description     ?? null,
      logo_url:        retailer.logo_url        ?? null,
      cover_image_url: retailer.cover_image_url ?? null,
      phone:           retailer.phone           ?? null,
      email:           retailer.email           ?? null,
    },
    categories,
    location: location ?? null,
    links:    links    ?? [],
    offer:    offer    ?? null,
    offerRules,
  };

  // ── Compute quality score ──────────────────────────────────────────────
  const hasAddr = Boolean(location?.address_line_1?.trim() && location?.postcode?.trim());
  const hasHrs  = hasOpenDay(location?.opening_hours_json);
  const hasCtc  = Boolean(retailer.phone?.trim()) || Boolean(retailer.email?.trim()) || (links ?? []).length > 0;
  const hasOff  = Boolean(offer?.title?.trim() && offer?.value_text?.trim());

  const score = computeQualityScore({
    name:            retailer.name,
    description:     retailer.description,
    tagline:         retailer.tagline,
    cover_image_url: retailer.cover_image_url,
    logo_url:        retailer.logo_url,
    phone:           retailer.phone,
    email:           retailer.email,
    categoryCount:   categories.length,
    hasAddress:      hasAddr,
    hasOpenDay:      hasHrs,
    hasContact:      hasCtc,
    hasOffer:        hasOff,
  });

  // ── Server action wrappers (bind retailer ID) ──────────────────────────
  async function approve() {
    'use server';
    await approveRetailer(retailerId);
  }
  async function reject(_: string, note: string) {
    'use server';
    await rejectRetailer(retailerId, note);
  }
  async function requestChanges(_: string, note: string) {
    'use server';
    await requestRetailerChanges(retailerId, note);
  }

  const submittedAt = retailer.submitted_at
    ? new Date(retailer.submitted_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null;

  return (
    <div className="max-w-5xl">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/review" className="text-sm text-gray-500 hover:text-gray-700">
            ← Review queue
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-semibold">{retailer.name}</h1>
          <StatusBadge status={retailer.approval_status} />
          <QualityBadge score={score} />
        </div>
        <Link
          href={`/retailers/${retailerId}/preview`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          Preview as customer ↗
        </Link>
      </div>

      {submittedAt && (
        <p className="mb-5 text-sm text-gray-500">
          Submitted {submittedAt}
        </p>
      )}

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* Left: listing preview */}
        <div>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Consumer listing preview
          </p>
          <RetailerListingCard data={listingData} />
        </div>

        {/* Right: actions + timeline */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <ReviewActionPanel
            retailerId={retailerId}
            currentStatus={retailer.approval_status}
            approveAction={approve}
            rejectAction={reject}
            requestChangesAction={requestChanges}
          />
          <ReviewTimeline
          entries={(auditRows ?? []).map((a) => ({
            id:          a.id,
            action_type: a.action_type,
            reason:      a.reason ?? null,
            created_at:  a.created_at,
            profiles: Array.isArray(a.profiles)
              ? (a.profiles[0] ?? null)
              : (a.profiles ?? null),
          }))}
        />
        </aside>
      </div>

      {/* ── Venues ──────────────────────────────────────────────────────── */}
      <div className="mt-8 max-w-2xl">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Venues</h2>
        {(() => {
          const extraQty   = subData?.extra_venues_quantity ?? 0;
          const computed   = 1 + extraQty;
          const override   = subData?.venue_allowance_override ?? null;
          const allowance  = override ?? computed;
          const activeVenues = (venues ?? []).filter((v) => v.is_active);

          return (
            <div className="space-y-4">
              {/* Allowance summary */}
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm space-y-1">
                <p className="font-medium text-gray-700">
                  {activeVenues.length} of {allowance} venue{allowance !== 1 ? 's' : ''} used
                </p>
                <p className="text-xs text-gray-400">
                  Base: 1 · Extra purchased: {extraQty}
                  {override !== null ? ` · Override: ${override}` : ''}
                </p>
              </div>

              {/* Venue list */}
              {activeVenues.length === 0 ? (
                <p className="text-sm text-gray-400">No active venues.</p>
              ) : (
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white overflow-hidden">
                  {activeVenues.map((v) => (
                    <div key={v.id} className="flex items-center justify-between px-4 py-3 gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {v.name ?? v.address_line_1 ?? 'Unnamed'}
                          </p>
                          {v.is_primary && (
                            <span className="shrink-0 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">
                              Primary
                            </span>
                          )}
                        </div>
                        {v.name && (
                          <p className="text-xs text-gray-400 truncate">
                            {[v.address_line_1, v.town, v.postcode].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                      {activeVenues.length > 1 && !v.is_primary && (
                        <form action={deactivateRetailerVenue}>
                          <input type="hidden" name="location_id" value={v.id} />
                          <input type="hidden" name="retailer_id" value={retailerId} />
                          <button
                            type="submit"
                            onClick={(e) => {
                              if (!confirm('Deactivate this venue?')) e.preventDefault();
                            }}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Deactivate
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Allowance override */}
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Override venue allowance</p>
                <form action={setVenueAllowanceOverride} className="flex items-center gap-3">
                  <input type="hidden" name="retailer_id" value={retailerId} />
                  <input
                    type="number"
                    name="override"
                    min={1}
                    defaultValue={override ?? ''}
                    placeholder={`Computed: ${computed}`}
                    className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900
                               focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
                  >
                    Set override
                  </button>
                  {override !== null && (
                    <form action={setVenueAllowanceOverride}>
                      <input type="hidden" name="retailer_id" value={retailerId} />
                      <input type="hidden" name="override" value="" />
                      <button
                        type="submit"
                        className="text-sm text-gray-400 hover:text-gray-600"
                      >
                        Clear
                      </button>
                    </form>
                  )}
                </form>
                <p className="mt-2 text-xs text-gray-400">
                  Leave blank or clear to revert to the computed value (1 + purchased extras).
                </p>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
