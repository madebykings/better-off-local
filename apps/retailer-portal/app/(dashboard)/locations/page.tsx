import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { deactivateVenue } from '@/lib/actions/location';
import { VenueCapDialog } from '@/components/locations/venue_cap_dialog';

export const metadata: Metadata = { title: 'Locations – Retailer Portal' };

function formatAddress(loc: {
  address_line_1: string | null;
  town: string | null;
  postcode: string | null;
}) {
  return [loc.address_line_1, loc.town, loc.postcode]
    .filter(Boolean)
    .join(', ');
}

export default async function LocationsPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const [{ data: locations }, { data: sub }, { data: locationWithRegion }] =
    await Promise.all([
      supabase
        .from('retailer_locations')
        .select('id, name, address_line_1, town, postcode, is_primary, is_active, billing_status, region_id')
        .eq('retailer_id', retailerId)
        .eq('is_active', true)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true }),
      supabase
        .from('retailer_subscriptions')
        .select('extra_venues_quantity, venue_allowance_override')
        .eq('retailer_id', retailerId)
        .eq('status', 'active')
        .maybeSingle(),
      supabase
        .from('retailer_locations')
        .select('region_id')
        .eq('retailer_id', retailerId)
        .eq('is_primary', true)
        .eq('is_active', true)
        .maybeSingle(),
    ]);

  // Fetch region stats for the primary venue's region.
  const primaryRegionId = locationWithRegion?.region_id;
  let regionStats: {
    region_name: string;
    active_member_count: number;
    paying_member_count: number;
    active_retailer_count: number;
    live_offer_count: number;
    member_threshold: number;
    billing_status: string | null;
  } | null = null;

  if (primaryRegionId) {
    const { data: statsRow } = await supabase
      .from('region_public_stats')
      .select('name, active_member_count, paying_member_count, active_retailer_count, live_offer_count, member_threshold')
      .eq('id', primaryRegionId)
      .maybeSingle();

    const { data: primaryLoc } = await supabase
      .from('retailer_locations')
      .select('billing_status')
      .eq('retailer_id', retailerId)
      .eq('is_primary', true)
      .maybeSingle();

    if (statsRow) {
      regionStats = {
        region_name: statsRow.name ?? 'Your region',
        active_member_count: statsRow.active_member_count ?? 0,
        paying_member_count: statsRow.paying_member_count ?? 0,
        active_retailer_count: statsRow.active_retailer_count ?? 0,
        live_offer_count: statsRow.live_offer_count ?? 0,
        member_threshold: statsRow.member_threshold ?? 100,
        billing_status: primaryLoc?.billing_status ?? null,
      };
    }
  }

  const BILLING_BADGES: Record<string, string> = {
    free_growth_region: 'bg-blue-50 text-blue-700 border-blue-200',
    paid_required:      'bg-amber-50 text-amber-700 border-amber-200',
    paid:               'bg-green-50 text-green-700 border-green-200',
    admin_waived:       'bg-purple-50 text-purple-700 border-purple-200',
    inactive:           'bg-gray-50 text-gray-500 border-gray-200',
  };

  const extraQty    = sub?.extra_venues_quantity ?? 0;
  const allowance   = sub?.venue_allowance_override ?? (1 + extraQty);
  const activeCount = locations?.length ?? 0;
  const atCap       = activeCount >= allowance;
  const canDeactivate = activeCount > 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Locations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your trading addresses shown on the map and your listing.
          </p>
        </div>

        {/* Add location CTA — always visible.
            When at cap, clicking shows a billing explanation dialog. */}
        {atCap ? (
          <VenueCapDialog />
        ) : (
          <Link
            href="/locations/new"
            className="text-sm px-4 py-2 rounded-lg transition-colors bg-green-800 text-white hover:bg-green-700"
          >
            Add location
          </Link>
        )}
      </div>

      {/* Region growth stats */}
      {regionStats && (
        <div className="mb-6 rounded-lg border border-blue-100 bg-blue-50 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-blue-900">
              {regionStats.region_name}
            </h2>
            {regionStats.billing_status === 'free_growth_region' && (
              <span className="text-xs font-medium text-blue-600 bg-blue-100 border border-blue-200 rounded px-2 py-0.5">
                Free Growth Region
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
            <div>
              <p className="text-lg font-bold text-blue-900">{regionStats.paying_member_count}</p>
              <p className="text-xs text-blue-600">Active members</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-900">{regionStats.member_threshold}</p>
              <p className="text-xs text-blue-600">Target</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-900">{regionStats.active_retailer_count}</p>
              <p className="text-xs text-blue-600">Retailers</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-900">{regionStats.live_offer_count}</p>
              <p className="text-xs text-blue-600">Live offers</p>
            </div>
          </div>
          {/* Progress bar */}
          {regionStats.member_threshold > 0 && (
            <div>
              <div className="flex justify-between text-xs text-blue-600 mb-1">
                <span>
                  {Math.round((regionStats.paying_member_count / regionStats.member_threshold) * 100)}% to billing activation
                </span>
                <span>
                  {Math.max(0, regionStats.member_threshold - regionStats.paying_member_count)} more members needed
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-blue-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{
                    width: `${Math.min(100, (regionStats.paying_member_count / regionStats.member_threshold) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
          {regionStats.billing_status === 'free_growth_region' && (
            <p className="mt-2 text-xs text-blue-600">
              Your first venue is free while {regionStats.region_name} grows.
              Billing activates once the region reaches {regionStats.member_threshold} members.
            </p>
          )}
        </div>
      )}

      {/* Allowance bar */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-700">
            {activeCount} of {allowance} venue{allowance !== 1 ? 's' : ''} used
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Base plan includes 1 venue
            {extraQty > 0 ? ` · ${extraQty} extra venue${extraQty !== 1 ? 's' : ''} purchased` : ''}
            {sub?.venue_allowance_override != null ? ' · allowance set by admin' : ''}
          </p>
        </div>
        {atCap && (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 font-medium">
            At capacity
          </span>
        )}
      </div>

      {/* Venue list */}
      {!locations || locations.length === 0 ? (
        <div className="text-center py-16 text-gray-400 border border-gray-200 rounded-lg">
          <p className="text-4xl mb-3">📍</p>
          <p className="font-medium text-gray-600">No locations yet</p>
          <p className="text-sm mt-1">Add your first trading address.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {loc.name ?? formatAddress(loc) ?? 'Unnamed venue'}
                  </p>
                  {loc.is_primary && (
                    <span className="shrink-0 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700">
                      Primary
                    </span>
                  )}
                  {(loc as any).billing_status && (
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium ${BILLING_BADGES[(loc as any).billing_status] ?? ''}`}>
                      {((loc as any).billing_status as string).replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                {loc.name && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{formatAddress(loc)}</p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/locations/${loc.id}`}
                  className="text-sm text-green-700 hover:text-green-800 font-medium"
                >
                  Edit
                </Link>
                {canDeactivate && !loc.is_primary && (
                  <form action={deactivateVenue}>
                    <input type="hidden" name="location_id" value={loc.id} />
                    <button
                      type="submit"
                      onClick={(e) => {
                        if (!confirm('Deactivate this venue? Offers assigned only to this venue will apply to all venues.')) {
                          e.preventDefault();
                        }
                      }}
                      className="text-sm text-red-500 hover:text-red-700 transition-colors"
                    >
                      Deactivate
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
