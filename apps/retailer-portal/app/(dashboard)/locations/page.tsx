import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { deactivateVenue } from '@/lib/actions/location';

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

  const [{ data: locations }, { data: sub }] = await Promise.all([
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
  ]);

  const BILLING_BADGES: Record<string, string> = {
    free_growth_region: 'bg-blue-50 text-blue-700 border-blue-200',
    paid_required:      'bg-amber-50 text-amber-700 border-amber-200',
    paid:               'bg-green-50 text-green-700 border-green-200',
    admin_waived:       'bg-purple-50 text-purple-700 border-purple-200',
    inactive:           'bg-gray-50 text-gray-500 border-gray-200',
  };

  const extraQty   = sub?.extra_venues_quantity ?? 0;
  const allowance  = sub?.venue_allowance_override ?? (1 + extraQty);
  const activeCount = locations?.length ?? 0;
  const atCap      = activeCount >= allowance;
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
        <Link
          href="/locations/new"
          className={[
            'text-sm px-4 py-2 rounded-lg transition-colors',
            atCap
              ? 'bg-gray-100 text-gray-500 cursor-default'
              : 'bg-green-800 text-white hover:bg-green-700',
          ].join(' ')}
        >
          Add location
        </Link>
      </div>

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
          <Link
            href="/locations/new"
            className="shrink-0 text-xs font-semibold text-green-700 hover:text-green-800 border border-green-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            Add venue — £9.99/yr
          </Link>
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
                    <span className="shrink-0 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700">
                      Primary
                    </span>
                  )}
                  {(loc as any).billing_status && (
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium ${BILLING_BADGES[(loc as any).billing_status] ?? ''}`}>
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
                      className="text-sm text-gray-400 hover:text-red-600 transition-colors"
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
