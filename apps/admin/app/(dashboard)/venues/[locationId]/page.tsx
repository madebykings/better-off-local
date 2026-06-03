import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require_admin';
import { createServiceClient } from '@/lib/supabase/service';
import {
  approveVenue,
  rejectVenue,
  toggleVenueFeatured,
  setVenueRegion,
  setVenueBillingStatus,
  deactivateRetailerVenue,
  updateVenueDetails,
  updateAdminVenueOpeningHours,
} from '@/lib/actions/admin';
import { AdminOpeningHoursEditor } from '@/components/venue/opening_hours_editor';
import { AdminVenueImageSlot } from '@/components/venue/venue_image_upload';
import { parseOpeningHours } from '@/lib/utils/opening_hours';

export const metadata: Metadata = { title: 'Venue – Admin' };

interface Props {
  params: Promise<{ locationId: string }>;
}

const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

function hasOpenDay(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  return DAY_KEYS.some((day) => {
    const entry = (raw as Record<string, unknown>)[day];
    if (!entry || typeof entry !== 'object') return false;
    return (entry as Record<string, unknown>).open === true;
  });
}

function ReviewBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    draft:    { label: 'Draft',    cls: 'bg-gray-100 text-gray-600 border-gray-200' },
    pending:  { label: 'Pending',  cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    approved: { label: 'Approved', cls: 'bg-green-100 text-green-700 border-green-200' },
    rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700 border-red-200' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
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
  if (params.name?.trim())                                            score += 10;
  if (params.description?.trim() || params.short_description?.trim()) score += 10;
  if (params.cover_image_url)                                         score += 20;
  if (params.logo_url)                                                score += 5;
  if (params.hasAddress)                                              score += 15;
  if (params.hasOpenDay)                                              score += 10;
  if (params.phone?.trim() || params.website_url?.trim())             score += 15;
  if (params.hasCategory)                                             score += 5;
  if (params.hasOffer)                                                score += 10;
  return score;
}

export default async function VenueDetailPage({ params }: Props) {
  await requireAdmin();
  const { locationId } = await params;
  const supabase = createServiceClient();

  const [
    { data: venue },
    { data: auditRows },
    { data: activeRegions },
  ] = await Promise.all([
    supabase
      .from('retailer_locations')
      .select('id, name, address_line_1, address_line_2, town, county, postcode, latitude, longitude, is_primary, is_active, is_featured, region_id, billing_status, grace_period_ends_at, opening_hours_json, logo_url, cover_image_url, phone, website_url, short_description, description, review_status, review_notes, submitted_at, retailer_id, retailers(id, name, is_active, approval_status, logo_url, cover_image_url)')
      .eq('id', locationId)
      .single(),
    supabase
      .from('admin_actions')
      .select('id, action_type, reason, created_at, profiles(full_name)')
      .eq('target_table', 'retailer_locations')
      .eq('target_id', locationId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('regions')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ]);

  if (!venue) notFound();

  const retailer = Array.isArray(venue.retailers) ? venue.retailers[0] : venue.retailers;
  const retailerId = venue.retailer_id as string;

  // Fetch enrichment data for quality score
  const [
    { data: categoryRows },
    { data: offerRow },
    { count: activeVenueCount },
  ] = await Promise.all([
    supabase
      .from('retailer_categories')
      .select('category_id')
      .eq('retailer_id', retailerId),
    supabase
      .from('offers')
      .select('id')
      .eq('retailer_id', retailerId)
      .eq('status', 'live')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('retailer_locations')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId)
      .eq('is_active', true),
  ]);

  const hasAddress = Boolean((venue.address_line_1 as string | null)?.trim() && (venue.postcode as string | null)?.trim());
  const hasHours   = hasOpenDay(venue.opening_hours_json);
  const qualityScore = computeVenueQuality({
    name:              venue.name as string | null,
    description:       venue.description as string | null,
    short_description: venue.short_description as string | null,
    cover_image_url:   venue.cover_image_url as string | null,
    logo_url:          venue.logo_url as string | null,
    phone:             venue.phone as string | null,
    website_url:       venue.website_url as string | null,
    hasAddress,
    hasOpenDay:        hasHours,
    hasCategory:       (categoryRows ?? []).length > 0,
    hasOffer:          Boolean(offerRow),
  });

  const submittedAt = (venue.submitted_at as string | null)
    ? new Date(venue.submitted_at as string).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null;

  const regions = activeRegions ?? [];
  const canDeactivate = (activeVenueCount ?? 0) > 1 && !venue.is_primary && venue.is_active;

  const BILLING_BADGES: Record<string, string> = {
    free_growth_region: 'bg-blue-50 text-blue-700 border-blue-200',
    paid_required:      'bg-amber-50 text-amber-700 border-amber-200',
    paid:               'bg-green-50 text-green-700 border-green-200',
    admin_waived:       'bg-purple-50 text-purple-700 border-purple-200',
    inactive:           'bg-gray-50 text-gray-500 border-gray-200',
  };

  return (
    <div className="max-w-3xl">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Link href="/venues" className="hover:text-gray-700">← Venues</Link>
          <span className="text-gray-300">/</span>
          {retailer && (
            <>
              <Link href={`/retailers/${retailerId}`} className="hover:text-gray-700">{retailer.name}</Link>
              <span className="text-gray-300">/</span>
            </>
          )}
          <span className="text-gray-700">{(venue.name as string | null) ?? 'Unnamed venue'}</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold">
            {(venue.name as string | null) ?? (venue.address_line_1 as string | null) ?? 'Unnamed venue'}
          </h1>
          <ReviewBadge status={(venue.review_status as string | null) ?? 'draft'} />
          <QualityBadge score={qualityScore} />
          {(venue.is_featured as boolean) && (
            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              ⭐ Featured
            </span>
          )}
          {!(venue.is_active as boolean) && (
            <span className="rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
              Inactive
            </span>
          )}
        </div>

        {(venue.address_line_1 as string | null) && (
          <p className="mt-1 text-sm text-gray-500">
            {[(venue.address_line_1 as string | null), (venue.town as string | null), (venue.postcode as string | null)].filter(Boolean).join(', ')}
          </p>
        )}

        {submittedAt && (
          <p className="mt-1 text-xs text-gray-400">Submitted {submittedAt}</p>
        )}

        {(venue.review_status as string) === 'rejected' && (venue.review_notes as string | null) && (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span className="font-medium">Rejection reason:</span> {venue.review_notes as string}
          </div>
        )}
      </div>

      {/* ── Moderation panel ────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Venue moderation</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Approve or reject this venue listing. Approved venues with <code className="font-mono">is_active = true</code> are visible in consumer discovery.
          </p>
        </div>
        <div className="px-4 py-4 space-y-3">
          {/* Approve */}
          {(venue.review_status as string) !== 'approved' && (
            <form action={approveVenue} className="flex items-center gap-3">
              <input type="hidden" name="location_id" value={locationId} />
              <input type="hidden" name="retailer_id" value={retailerId} />
              <button
                type="submit"
                className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-100 transition-colors"
              >
                Approve venue
              </button>
              <span className="text-xs text-gray-400">
                Sets review_status → approved. Venue becomes visible once is_active is true.
              </span>
            </form>
          )}

          {(venue.review_status as string) === 'approved' && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-green-700">✓ Venue approved</span>
              <span className="text-xs text-gray-400">— venue is visible in consumer discovery</span>
            </div>
          )}

          {/* Reject */}
          {(venue.review_status as string) !== 'rejected' && (
            <form action={rejectVenue} className="flex items-center gap-2 flex-wrap">
              <input type="hidden" name="location_id" value={locationId} />
              <input type="hidden" name="retailer_id" value={retailerId} />
              <input
                type="text"
                name="review_notes"
                placeholder="Rejection reason (required)"
                required
                className="flex-1 min-w-48 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
              />
              <button
                type="submit"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
              >
                Reject
              </button>
            </form>
          )}

          {(venue.review_status as string) === 'rejected' && (
            <form action={approveVenue} className="flex items-center gap-3">
              <input type="hidden" name="location_id" value={locationId} />
              <input type="hidden" name="retailer_id" value={retailerId} />
              <button
                type="submit"
                className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-100 transition-colors"
              >
                Approve (override rejection)
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ── Admin controls ───────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Admin controls</h2>
        </div>
        <div className="px-4 py-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            {/* Featured toggle */}
            <form action={toggleVenueFeatured} className="flex items-center gap-2">
              <input type="hidden" name="location_id" value={locationId} />
              <input type="hidden" name="retailer_id" value={retailerId} />
              <input type="hidden" name="is_featured" value={String((venue.is_featured as boolean) ?? false)} />
              <button
                type="submit"
                className={`text-sm font-medium rounded-lg border px-3 py-1.5 transition-colors ${
                  (venue.is_featured as boolean)
                    ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {(venue.is_featured as boolean) ? '⭐ Remove featured' : '☆ Set featured'}
              </button>
            </form>

            {/* Deactivate */}
            {canDeactivate && (
              <form action={deactivateRetailerVenue}>
                <input type="hidden" name="location_id" value={locationId} />
                <input type="hidden" name="retailer_id" value={retailerId} />
                <button
                  type="submit"
                  onClick={(e) => {
                    if (!confirm('Deactivate this venue? It will be removed from consumer discovery.')) e.preventDefault();
                  }}
                  className="text-sm font-medium rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-red-700 hover:bg-red-100 transition-colors"
                >
                  Deactivate venue
                </button>
              </form>
            )}
          </div>

          {/* Region */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Region</label>
            <form action={setVenueRegion} className="flex items-center gap-2">
              <input type="hidden" name="location_id" value={locationId} />
              <select
                name="region_id"
                defaultValue={(venue.region_id as string | null) ?? ''}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-700 w-52"
              >
                <option value="">No region</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Save
              </button>
            </form>
          </div>

          {/* Billing status */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Billing status</label>
            <form action={setVenueBillingStatus} className="flex items-center gap-2">
              <input type="hidden" name="location_id" value={locationId} />
              <input type="hidden" name="retailer_id" value={retailerId} />
              <select
                name="billing_status"
                defaultValue={(venue.billing_status as string) ?? 'inactive'}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-700 w-52"
              >
                <option value="free_growth_region">Free — growth region</option>
                <option value="paid_required">Payment required</option>
                <option value="paid">Paid</option>
                <option value="admin_waived">Waived by admin</option>
              </select>
              <button
                type="submit"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Save
              </button>
            </form>
            {(venue.grace_period_ends_at as string | null) && (
              <p className="mt-1 text-xs text-amber-600">
                Grace period ends: {new Date(venue.grace_period_ends_at as string).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Opening hours ────────────────────────────────────────────────── */}
      <details className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-4 group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 select-none border-b border-gray-100 bg-gray-50">
          <span className="transition-transform group-open:rotate-90">▶</span>
          Opening hours
        </summary>
        <div className="px-4 py-4">
          <AdminOpeningHoursEditor
            locationId={locationId}
            initialData={parseOpeningHours(venue.opening_hours_json)}
            saveAction={updateAdminVenueOpeningHours}
          />
        </div>
      </details>

      {/* ── Images ───────────────────────────────────────────────────────── */}
      <details className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-4 group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 select-none border-b border-gray-100 bg-gray-50">
          <span className="transition-transform group-open:rotate-90">▶</span>
          Images
        </summary>
        <div className="px-4 py-4 space-y-5">
          <AdminVenueImageSlot
            locationId={locationId}
            slot="logo"
            label="Venue logo"
            hint="JPG, PNG, or WebP · max 5 MB · displayed at 400×400"
            currentUrl={(venue.logo_url as string | null) ?? null}
          />
          <AdminVenueImageSlot
            locationId={locationId}
            slot="cover"
            label="Cover image"
            hint="JPG, PNG, or WebP · max 10 MB · displayed at 1600×600"
            currentUrl={(venue.cover_image_url as string | null) ?? null}
          />
        </div>
      </details>

      {/* ── Consumer listing preview ─────────────────────────────────────── */}
      <details className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-4 group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 select-none border-b border-gray-100 bg-gray-50">
          <span className="transition-transform group-open:rotate-90">▶</span>
          Consumer listing preview
        </summary>
        <div className="px-4 py-4">
          <div className="max-w-xs rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            {((venue.cover_image_url as string | null) || retailer?.cover_image_url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={((venue.cover_image_url as string | null) || retailer?.cover_image_url) as string}
                alt=""
                className="w-full h-28 object-cover"
              />
            )}
            <div className="p-3 space-y-1">
              <div className="flex items-center gap-2">
                {((venue.logo_url as string | null) || retailer?.logo_url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={((venue.logo_url as string | null) || retailer?.logo_url) as string}
                    alt=""
                    className="w-8 h-8 rounded object-cover border border-gray-100 shrink-0"
                  />
                )}
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {(venue.name as string | null) ?? retailer?.name ?? 'Unnamed'}
                </p>
              </div>
              {(venue.short_description as string | null) && (
                <p className="text-xs text-gray-500 line-clamp-2">{venue.short_description as string}</p>
              )}
              <p className="text-xs text-gray-400">
                {[(venue.address_line_1 as string | null), (venue.town as string | null), (venue.postcode as string | null)].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        </div>
      </details>

      {/* ── Edit venue details ───────────────────────────────────────────── */}
      <details className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-4 group">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 select-none border-b border-gray-100 bg-gray-50">
          <span className="transition-transform group-open:rotate-90">▶</span>
          Edit venue details
        </summary>
        <form action={updateVenueDetails} className="px-4 py-4 space-y-4">
          <input type="hidden" name="location_id" value={locationId} />
          <input type="hidden" name="retailer_id" value={retailerId} />

          <div>
            <label className="block text-xs text-gray-500 mb-1">Venue name</label>
            <input
              type="text"
              name="name"
              defaultValue={(venue.name as string | null) ?? ''}
              placeholder="e.g. Main Street"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Address line 1</label>
              <input type="text" name="address_line_1" defaultValue={(venue.address_line_1 as string | null) ?? ''}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Address line 2</label>
              <input type="text" name="address_line_2" defaultValue={(venue.address_line_2 as string | null) ?? ''}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Town / City</label>
              <input type="text" name="town" defaultValue={(venue.town as string | null) ?? ''}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">County</label>
              <input type="text" name="county" defaultValue={(venue.county as string | null) ?? ''}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Postcode</label>
              <input type="text" name="postcode" defaultValue={(venue.postcode as string | null) ?? ''} placeholder="FK10 1AA"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Latitude</label>
              <input type="number" name="latitude" step="any" defaultValue={(venue.latitude as number | null) ?? ''} placeholder="56.1152"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Longitude</label>
              <input type="number" name="longitude" step="any" defaultValue={(venue.longitude as number | null) ?? ''} placeholder="-3.7683"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="venue_is_active"
              name="is_active"
              defaultChecked={(venue.is_active as boolean) ?? true}
              disabled={(venue.is_primary as boolean)}
              className="h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-700 disabled:opacity-50"
            />
            <label htmlFor="venue_is_active" className="text-xs text-gray-600">
              Active (visible on platform)
              {(venue.is_primary as boolean) && <span className="ml-1 text-gray-400">(cannot deactivate primary venue)</span>}
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-gray-100">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Phone</label>
              <input type="text" name="phone" defaultValue={(venue.phone as string | null) ?? ''} placeholder="01259 123456"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Website</label>
              <input type="text" name="website_url" defaultValue={(venue.website_url as string | null) ?? ''} placeholder="https://yoursite.com"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Short description</label>
            <textarea name="short_description" defaultValue={(venue.short_description as string | null) ?? ''} rows={2}
              placeholder="Brief description shown on the listing card."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700 resize-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Full description</label>
            <textarea name="description" defaultValue={(venue.description as string | null) ?? ''} rows={3}
              placeholder="Full marketing copy shown on the venue detail page."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-700 resize-none" />
          </div>
          <div>
            <button type="submit"
              className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
              Save venue
            </button>
          </div>
        </form>
      </details>

      {/* ── Audit trail ─────────────────────────────────────────────────── */}
      {(auditRows ?? []).length > 0 && (
        <details className="rounded-lg border border-gray-200 bg-white overflow-hidden mb-4 group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 select-none border-b border-gray-100 bg-gray-50">
            <span className="transition-transform group-open:rotate-90">▶</span>
            Audit trail ({(auditRows ?? []).length})
          </summary>
          <div className="divide-y divide-gray-100">
            {(auditRows ?? []).map((a) => {
              const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
              return (
                <div key={a.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono text-gray-700">{a.action_type}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {a.reason && <p className="text-xs text-gray-500 mt-0.5">{a.reason}</p>}
                  {(profile as any)?.full_name && (
                    <p className="text-xs text-gray-400 mt-0.5">by {(profile as any).full_name}</p>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
