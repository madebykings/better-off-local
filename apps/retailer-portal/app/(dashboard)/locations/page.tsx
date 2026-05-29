import type { Metadata } from 'next';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { LocationForm } from './location_form';
import type { LocationFields } from '@/lib/actions/location';

export const metadata: Metadata = { title: 'Locations – Retailer Portal' };

export default async function LocationsPage() {
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const { data: location } = await supabase
    .from('retailer_locations')
    .select('address_line_1, address_line_2, town, county, postcode')
    .eq('retailer_id', retailerId)
    .eq('is_primary', true)
    .maybeSingle();

  const initialData: LocationFields = {
    addressLine1: location?.address_line_1 ?? '',
    addressLine2: location?.address_line_2 ?? '',
    town: location?.town ?? '',
    county: location?.county ?? '',
    postcode: location?.postcode ?? '',
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Location</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your address is shown on your listing and used to place you on the map.
        </p>
      </div>
      <LocationForm initialData={initialData} />
    </div>
  );
}
