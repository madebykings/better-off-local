import type { Metadata } from 'next';
import Link from 'next/link';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { NewVenueForm } from './new_venue_form';

export const metadata: Metadata = { title: 'Add Location – Retailer Portal' };

export default async function NewLocationPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const [{ data: sub }, { count: activeCount }] = await Promise.all([
    supabase
      .from('retailer_subscriptions')
      .select('extra_venues_quantity, venue_allowance_override')
      .eq('retailer_id', retailerId)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('retailer_locations')
      .select('id', { count: 'exact', head: true })
      .eq('retailer_id', retailerId)
      .eq('is_active', true),
  ]);

  const extraQty  = sub?.extra_venues_quantity ?? 0;
  const allowance = sub?.venue_allowance_override ?? (1 + extraQty);
  const count     = activeCount ?? 0;
  const atCap     = count >= allowance;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/locations" className="hover:text-gray-600 transition-colors">Locations</Link>
          <span>›</span>
          <span className="text-gray-600">Add location</span>
        </div>
        <h1 className="text-2xl font-semibold">Add location</h1>
      </div>

      {atCap ? (
        /* Upgrade prompt */
        <div className="max-w-xl">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 mb-6">
            <p className="text-sm font-medium text-amber-800">
              You have used all {allowance} venue{allowance !== 1 ? 's' : ''} in your current plan.
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Purchase an additional venue slot to add another trading address.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Extra venue slot</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Adds one additional trading address to your listing
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-900">£10<span className="text-xs font-normal text-gray-400">/year</span></span>
            </div>
            <ul className="space-y-1.5 text-xs text-gray-500 mb-5">
              <li>✓ Pro-rated charge — billed to your existing payment method</li>
              <li>✓ Renews with your annual subscription</li>
              <li>✓ Venue appears on the map and your listing</li>
            </ul>
            <NewVenueForm atCap={true} />
          </div>
        </div>
      ) : (
        /* Create form */
        <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 max-w-xl">
          Using {count} of {allowance} venue{allowance !== 1 ? 's' : ''}. You can add {allowance - count} more.
        </div>
      )}

      {!atCap && <NewVenueForm atCap={false} />}
    </div>
  );
}
