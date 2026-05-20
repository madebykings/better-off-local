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
            // Supabase returns profiles as an array for joined selects.
            profiles: Array.isArray(a.profiles)
              ? (a.profiles[0] ?? null)
              : (a.profiles ?? null),
          }))}
        />
        </aside>
      </div>
    </div>
  );
}
