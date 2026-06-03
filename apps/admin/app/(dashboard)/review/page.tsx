import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';

export const metadata: Metadata = { title: 'Review queue – Admin' };

interface Props {
  searchParams: Promise<{ tab?: string }>;
}

const TABS = [
  { id: 'pending',  label: 'Pending' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all',      label: 'All submitted' },
] as const;

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

function hasOpenDay(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  return DAY_KEYS.some((day) => {
    const entry = (raw as Record<string, unknown>)[day];
    if (!entry || typeof entry !== 'object') return false;
    return (entry as Record<string, unknown>).open === true;
  });
}

function computeVenueQuality(params: {
  name: string | null;
  description: string | null;
  short_description: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  phone: string | null;
  website_url: string | null;
  hasAddress: boolean;
  hasOpenDay: boolean;
  hasCategory: boolean;
  hasOffer: boolean;
}): number {
  let score = 0;
  if (params.name?.trim())                                             score += 10;
  if (params.description?.trim() || params.short_description?.trim()) score += 10;
  if (params.cover_image_url)                                          score += 20;
  if (params.logo_url)                                                 score += 5;
  if (params.hasAddress)                                               score += 15;
  if (params.hasOpenDay)                                               score += 10;
  if (params.phone?.trim() || params.website_url?.trim())              score += 15;
  if (params.hasCategory)                                              score += 5;
  if (params.hasOffer)                                                 score += 10;
  return score;
}

function QualityBadge({ score }: { score: number }) {
  const cls =
    score >= 80
      ? 'bg-green-100 text-green-700 border-green-200'
      : score >= 55
        ? 'bg-amber-100 text-amber-700 border-amber-200'
        : 'bg-red-100 text-red-700 border-red-200';
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {score}/100
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function ReviewQueuePage({ searchParams }: Props) {
  await requireAdmin();
  const { tab } = await searchParams;
  const activeTab = tab ?? 'pending';
  const supabase = createServiceClient();

  let query = supabase
    .from('retailer_locations')
    .select(
      'id, name, address_line_1, postcode, cover_image_url, logo_url, phone, website_url, short_description, description, opening_hours_json, review_status, submitted_at, updated_at, retailer_id, retailers(id, name)',
    )
    .order('submitted_at', { ascending: true, nullsFirst: false });

  if (activeTab === 'pending') {
    query = query.eq('review_status', 'pending');
  } else if (activeTab === 'rejected') {
    query = query.eq('review_status', 'rejected');
  } else {
    query = query.in('review_status', ['pending', 'approved', 'rejected']);
  }

  const { data: venueRows } = await query;
  const venues = (venueRows ?? []) as Array<{
    id: string;
    name: string | null;
    address_line_1: string | null;
    postcode: string | null;
    cover_image_url: string | null;
    logo_url: string | null;
    phone: string | null;
    website_url: string | null;
    short_description: string | null;
    description: string | null;
    opening_hours_json: unknown;
    review_status: string;
    submitted_at: string | null;
    updated_at: string | null;
    retailer_id: string;
    retailers: { id: string; name: string } | { id: string; name: string }[] | null;
  }>;

  if (venues.length === 0) {
    return (
      <QueueLayout activeTab={activeTab}>
        <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 py-20 text-center">
          <p className="text-3xl">✅</p>
          <p className="mt-3 font-medium text-gray-600">Queue is clear</p>
          <p className="mt-1 text-sm text-gray-400">No venues awaiting review.</p>
        </div>
      </QueueLayout>
    );
  }

  const retailerIds = [...new Set(venues.map((v) => v.retailer_id))];

  const [
    { data: categoryRows },
    { data: offerRows },
  ] = await Promise.all([
    supabase
      .from('retailer_categories')
      .select('retailer_id')
      .in('retailer_id', retailerIds),
    supabase
      .from('offers')
      .select('retailer_id')
      .in('retailer_id', retailerIds)
      .eq('status', 'live'),
  ]);

  const categoryRetailers = new Set((categoryRows ?? []).map((r) => r.retailer_id));
  const offerRetailers    = new Set((offerRows ?? []).map((r) => r.retailer_id));

  const rows = venues.map((v) => {
    const retailer = Array.isArray(v.retailers) ? v.retailers[0] : v.retailers;
    const hasAddress = Boolean(v.address_line_1?.trim() && v.postcode?.trim());
    const hasHours   = hasOpenDay(v.opening_hours_json);
    const score = computeVenueQuality({
      name:              v.name,
      description:       v.description,
      short_description: v.short_description,
      cover_image_url:   v.cover_image_url,
      logo_url:          v.logo_url,
      phone:             v.phone,
      website_url:       v.website_url,
      hasAddress,
      hasOpenDay:        hasHours,
      hasCategory:       categoryRetailers.has(v.retailer_id),
      hasOffer:          offerRetailers.has(v.retailer_id),
    });
    return { ...v, retailer, score };
  });

  return (
    <QueueLayout activeTab={activeTab}>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Venue</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Retailer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Submitted</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Quality</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                {/* Venue cell */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      {v.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.cover_image_url} alt="" className="h-12 w-20 rounded-md object-cover" />
                      ) : (
                        <div className="h-12 w-20 rounded-md bg-gray-200" />
                      )}
                      {v.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.logo_url} alt="" className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-md border border-white bg-white object-contain shadow-sm" />
                      ) : (
                        <div className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-md border border-white bg-gray-100 shadow-sm" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{v.name ?? v.address_line_1 ?? 'Unnamed venue'}</p>
                      {v.address_line_1 && (
                        <p className="text-xs text-gray-400">{[v.address_line_1, v.postcode].filter(Boolean).join(', ')}</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Retailer */}
                <td className="px-4 py-3">
                  {v.retailer ? (
                    <Link href={`/retailers/${v.retailer.id}`} className="font-medium text-gray-800 hover:text-green-700">
                      {v.retailer.name}
                    </Link>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>

                {/* Submitted date */}
                <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                  {formatDate(v.submitted_at ?? v.updated_at)}
                </td>

                {/* Quality score */}
                <td className="px-4 py-3">
                  <QualityBadge score={v.score} />
                </td>

                {/* Review status */}
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium capitalize ${
                    v.review_status === 'pending'  ? 'border-amber-200 bg-amber-100 text-amber-800' :
                    v.review_status === 'approved' ? 'border-green-200 bg-green-100 text-green-800' :
                    v.review_status === 'rejected' ? 'border-red-200 bg-red-100 text-red-800' :
                    'border-gray-200 bg-gray-100 text-gray-600'
                  }`}>
                    {v.review_status}
                  </span>
                </td>

                {/* Review link */}
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/venues/${v.id}`}
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

function QueueLayout({ activeTab, children }: { activeTab: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Review queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Venues awaiting review. Oldest submissions first. Approve or reject from the venue page.
        </p>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/review${t.id === 'pending' ? '' : `?tab=${t.id}`}`}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
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
