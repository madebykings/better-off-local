import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Review queue – Admin' };

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

// ---------------------------------------------------------------------------
// Quality score (same weights as retailer portal listing_preview.tsx)
// ---------------------------------------------------------------------------

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
  if (params.name?.trim())                                 score += 10;
  if (params.description?.trim() || params.tagline?.trim()) score += 10;
  if (params.cover_image_url)                              score += 15;
  if (params.logo_url)                                     score += 5;
  if (params.categoryCount > 0)                           score += 10;
  if (params.hasAddress)                                   score += 10;
  if (params.hasOpenDay)                                   score += 10;
  if (params.hasContact)                                   score += 15;
  if (params.hasOffer)                                     score += 15;
  return score;
}

// ---------------------------------------------------------------------------
// Quality score badge — 95–100 green, 75–94 amber, <75 red
// ---------------------------------------------------------------------------

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
// Opening hours helper (inlined)
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const TABS = [
  { id: 'pending',           label: 'Pending' },
  { id: 'changes_requested', label: 'Changes requested' },
  { id: 'all',               label: 'All submitted' },
] as const;

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function ReviewQueuePage({ searchParams }: Props) {
  await requireAdmin();
  const { tab } = await searchParams;
  const activeTab = tab ?? 'pending';
  const supabase = createServiceClient();

  // ── Fetch retailers in the review queue ────────────────────────────────────
  let query = supabase
    .from('retailers')
    .select(
      'id, name, tagline, description, logo_url, cover_image_url, phone, email, approval_status, submitted_at, updated_at',
    )
    .eq('onboarding_step', 'submitted')
    .order('submitted_at', { ascending: true, nullsFirst: false });

  if (activeTab === 'pending') {
    query = query.eq('approval_status', 'pending');
  } else if (activeTab === 'changes_requested') {
    query = query.eq('approval_status', 'changes_requested');
  } else {
    query = query.in('approval_status', ['pending', 'approved', 'rejected', 'changes_requested']);
  }

  const { data: retailers } = await query;
  const ids = (retailers ?? []).map((r) => r.id);

  if (ids.length === 0) {
    return (
      <QueueLayout activeTab={activeTab}>
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 py-20 text-center">
          <p className="text-3xl">✅</p>
          <p className="mt-3 font-medium text-gray-600">Queue is clear</p>
          <p className="mt-1 text-sm text-gray-400">No retailers awaiting review.</p>
        </div>
      </QueueLayout>
    );
  }

  // ── Batch-fetch enrichment data ────────────────────────────────────────────
  const [
    { data: categoryRows },
    { data: locationRows },
    { data: offerRows },
    { data: linkRows },
  ] = await Promise.all([
    supabase
      .from('retailer_categories')
      .select('retailer_id')
      .in('retailer_id', ids),
    supabase
      .from('retailer_locations')
      .select('retailer_id, address_line_1, postcode, opening_hours_json')
      .in('retailer_id', ids)
      .eq('is_primary', true),
    supabase
      .from('offers')
      .select('retailer_id, title, value_text')
      .in('retailer_id', ids)
      .eq('onboarding_source', 'first-offer'),
    supabase
      .from('retailer_links')
      .select('retailer_id')
      .in('retailer_id', ids),
  ]);

  // Build lookup maps by retailer_id.
  const catCounts = new Map<string, number>();
  for (const row of categoryRows ?? []) {
    catCounts.set(row.retailer_id, (catCounts.get(row.retailer_id) ?? 0) + 1);
  }

  const locationMap = new Map<string, { address_line_1: string | null; postcode: string | null; opening_hours_json: unknown }>();
  for (const row of locationRows ?? []) {
    locationMap.set(row.retailer_id, row);
  }

  const offerMap = new Map<string, { title: string | null; value_text: string | null }>();
  for (const row of offerRows ?? []) {
    offerMap.set(row.retailer_id, row);
  }

  const linkCounts = new Map<string, number>();
  for (const row of linkRows ?? []) {
    linkCounts.set(row.retailer_id, (linkCounts.get(row.retailer_id) ?? 0) + 1);
  }

  // ── Build enriched rows ────────────────────────────────────────────────────
  const rows = (retailers ?? []).map((r) => {
    const loc      = locationMap.get(r.id);
    const offer    = offerMap.get(r.id);
    const catCount = catCounts.get(r.id) ?? 0;
    const linkCount = linkCounts.get(r.id) ?? 0;

    const hasAddress  = Boolean(loc?.address_line_1?.trim() && loc?.postcode?.trim());
    const hasHours    = hasOpenDay(loc?.opening_hours_json);
    const hasContact  = Boolean(r.phone?.trim()) || Boolean(r.email?.trim()) || linkCount > 0;
    const hasOffer    = Boolean(offer?.title?.trim() && offer?.value_text?.trim());

    const score = computeQualityScore({
      name:            r.name,
      description:     r.description,
      tagline:         r.tagline,
      cover_image_url: r.cover_image_url,
      logo_url:        r.logo_url,
      phone:           r.phone,
      email:           r.email,
      categoryCount:   catCount,
      hasAddress,
      hasOpenDay:      hasHours,
      hasContact,
      hasOffer,
    });

    return { ...r, offer, catCount, score };
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <QueueLayout activeTab={activeTab}>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Retailer
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                First offer
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Submitted
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Quality
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                {/* Retailer cell: cover thumb + logo + name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      {r.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.cover_image_url}
                          alt=""
                          className="h-12 w-20 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-12 w-20 rounded-md bg-gray-200" />
                      )}
                      {r.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.logo_url}
                          alt=""
                          className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-md border border-white bg-white object-contain shadow-sm"
                        />
                      ) : (
                        <div className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-md border border-white bg-gray-100 shadow-sm" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{r.name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{r.catCount} categor{r.catCount === 1 ? 'y' : 'ies'}</p>
                    </div>
                  </div>
                </td>

                {/* First offer */}
                <td className="px-4 py-3">
                  {r.offer ? (
                    <div>
                      <p className="font-medium text-gray-800">{r.offer.value_text}</p>
                      <p className="text-xs text-gray-500">{r.offer.title}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">No offer</span>
                  )}
                </td>

                {/* Submitted date */}
                <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                  {formatDate(r.submitted_at ?? r.updated_at)}
                </td>

                {/* Quality score */}
                <td className="px-4 py-3">
                  <QualityBadge score={r.score} />
                </td>

                {/* Approval status */}
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${
                    r.approval_status === 'pending'           ? 'border-amber-200 bg-amber-100 text-amber-800' :
                    r.approval_status === 'approved'          ? 'border-green-200 bg-green-100 text-green-800' :
                    r.approval_status === 'rejected'          ? 'border-red-200 bg-red-100 text-red-800' :
                    r.approval_status === 'changes_requested' ? 'border-orange-200 bg-orange-100 text-orange-800' :
                    'border-gray-200 bg-gray-100 text-gray-600'
                  }`}>
                    {r.approval_status.replace('_', ' ')}
                  </span>
                </td>

                {/* Review link */}
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/retailers/${r.id}`}
                    className="font-medium text-green-700 hover:text-green-900"
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </QueueLayout>
  );
}

// ---------------------------------------------------------------------------
// Layout wrapper (shared between empty state and table view)
// ---------------------------------------------------------------------------

function QueueLayout({
  activeTab,
  children,
}: {
  activeTab: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Review queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Retailers that have submitted for approval. Oldest submissions first.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/review${t.id === 'pending' ? '' : `?tab=${t.id}`}`}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
