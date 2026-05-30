import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRetailerUser } from '@/lib/auth/require_retailer_user';
import { createServiceClient } from '@/lib/supabase/service';
import { VenueForm } from '../location_form';
import type { VenueFields } from '@/lib/actions/location';

export const metadata: Metadata = { title: 'Edit Location – Retailer Portal' };

interface Props {
  params: Promise<{ locationId: string }>;
}

export default async function LocationDetailPage({ params }: Props) {
  const { locationId } = await params;
  const { retailerId } = await requireRetailerUser();
  const supabase = createServiceClient();

  const { data: loc } = await supabase
    .from('retailer_locations')
    .select('id, name, address_line_1, address_line_2, town, county, postcode, is_primary, is_active')
    .eq('id', locationId)
    .eq('retailer_id', retailerId)
    .eq('is_active', true)
    .maybeSingle();

  if (!loc) notFound();

  const initialData: VenueFields = {
    name:         loc.name ?? '',
    addressLine1: loc.address_line_1 ?? '',
    addressLine2: loc.address_line_2 ?? '',
    town:         loc.town ?? '',
    county:       loc.county ?? '',
    postcode:     loc.postcode ?? '',
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
          <Link href="/locations" className="hover:text-gray-600 transition-colors">Locations</Link>
          <span>›</span>
          <span className="text-gray-600 truncate">
            {loc.name ?? loc.address_line_1 ?? 'Edit venue'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{loc.name ?? 'Edit venue'}</h1>
          {loc.is_primary && (
            <span className="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              Primary
            </span>
          )}
        </div>
      </div>

      <VenueForm locationId={locationId} initialData={initialData} />
    </div>
  );
}
